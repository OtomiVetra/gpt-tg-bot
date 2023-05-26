import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { openai } from './openai.js'
import db from './model/db.js'
import User from './model/TUser.js'
import Message from './model/TMessage.js'

// import { addUser } from './db.js'

// console.log(config.get('TEST_ENV'))

const INITIAL_SESSION = {
  messages: [],
}


const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.command('new', async (ctx) => {
  ctx.session = { messages: [] }
  await ctx.reply('Жду голосовуху..')
})

bot.command('start', async (ctx) => {
  // 0.1) user написал в tg команду /start
  // добавить пользователя при первом обращении к боту
  let user = await User.findOne({ telegram_id: ctx.message.chat.id })
  if (user) {
    await ctx.reply('Жду голосовуху..')
  } else {
    user = new User({
      telegram_id: ctx.message.chat.id,
      username: ctx.message.from.username,
      access_timestamp: Date.now()
    })
    await user.save()
    // отправка админу кнопок для подтверждения на 15 мин, бессрочного и отклонения
    const admin = await User.findOne({ role: 'admin' })
    ctx.reply(`зарегистрировался пользователь ${user.username}\nкакова ваша воля?`, {
      chat_id: admin.telegram_id,
      reply_markup: {
        inline_keyboard: [
          [{
            text: 'дать доступ на 15 минут',
            callback_data: `add_time:${user.telegram_id}:15min`
          },
          {
            text: 'дать бесконечный доступ',
            callback_data: `add_time:${user.telegram_id}:infinity`
          },
          {
            text: 'отказать в доступе',
            callback_data: `add_time:${user.telegram_id}:none`
          }
          ]
        ]
      }
    })
  }


  // реакция админа
  // уведомление о реакции админа

  // ctx.session = INITIAL_SESSION
  // await ctx.reply('Жду голосовуху..')
})

bot.on('callback_query', async (ctx) => {
  const data = ctx.update.callback_query.data;
  console.log('Received callback:', data);
  const [command] = data.split(':')
  if (command === 'add_time') {
    const [, user_id, period] = data.split(':')
    if (period === 'none') {
      ctx.reply('В милости отказано', {
        chat_id: user_id
      })
    } else if (
      period === '15min'
    ) {
      const user = await User.findOne({ telegram_id: user_id })
      user.access_timestamp = Date.now() + 15 * 60 * 1000
      await user.save()
      ctx.reply('У вас есть 15 минут, потратьте их с умом!', {
        chat_id: user_id
      })
    } else if (
      period === 'infinity'
    ) {
      const user = await User.findOne({ telegram_id: user_id })
      user.access_timestamp = Date.now() + 365 * 24 * 60 * 60 * 1000
      await user.save()
      ctx.reply('У вас есть бесконечное знание!', {
        chat_id: user_id
      })
    }
  } else if (command === 'request_time') {
    const admin = await User.findOne({ role: 'admin' })
    const user = await User.findOne({ telegram_id: ctx.from.id })
    ctx.reply(`пользователь ${user.username} просит добавочное время,\nкакова ваша воля?`, {
      chat_id: admin.telegram_id,
      reply_markup: {
        inline_keyboard: [
          [{
            text: 'дать доступ на 15 минут',
            callback_data: `add_time:${user.telegram_id}:15min`
          },
          {
            text: 'дать бесконечный доступ',
            callback_data: `add_time:${user.telegram_id}:infinity`
          },
          {
            text: 'отказать в доступе',
            callback_data: `add_time:${user.telegram_id}:none`
          }
          ]
        ]
      }
    })
  }
  // Дальнейшая обработка callback_query
});

bot.on(message('voice'), async ctx => {
  ctx.session ??= INITIAL_SESSION
  if (INITIAL_SESSION.messages.length > 20) {
    INITIAL_SESSION.messages.shift()
  }
  try {
    await ctx.reply(code('Соображаем маленечко...'))
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
    const userId = String(ctx.message.from.id)
    console.log(link.href)
    const oggPath = await ogg.create(link.href, userId)
    const mp3Path = await ogg.toMp3(oggPath, userId)

    const text = await openai.transcription(mp3Path)
    await ctx.reply(code(`Ваш запрос: ${text}`))
    ctx.session.messages.push({ role: openai.roles.USER, content: text })
    const response = await openai.chat(ctx.session.messages)
    if (response?.content) {
      ctx.session.messages.push({ role: openai.roles.ASSISTANT, content: response.content })
      await ctx.reply(response.content)
    } else {
      await ctx.reply('Попробуйте маленечко попозже...')
    }


  } catch (e) {
    console.log(`Error while voice message`, e.message)
  }
})



bot.on(message('text'), async ctx => {
  try {
    const user = await User.findOne({ telegram_id: ctx.message.chat.id })
    if (!user) {
      return ctx.reply('нажмите кнопку старт!')
    }
    if (user.access_timestamp < Date.now()) {
      return ctx.reply('время вышло, сообщить админу?)', {
        reply_markup: {
          inline_keyboard: [
            [{
              text: 'да',
              callback_data: `request_time`
            }
            ]
          ]
        }
      })
    }
  } catch (e) {
    console.log(`Error while text message`, e.message)
  }
  ctx.session ??= INITIAL_SESSION
  if (INITIAL_SESSION.messages.length > 20) {
    INITIAL_SESSION.messages.shift()
  }
  try {
    await ctx.reply(code('Соображаем маленечко...'))
    const userId = ctx.from.id;
    ctx.session.messages.push({ role: openai.roles.USER, content: ctx.message.text })
    const response = await openai.chat(ctx.session.messages)
    if (response?.content) {
      ctx.session.messages.push({ role: openai.roles.ASSISTANT, content: response.content })
      await ctx.reply(response.content)
    } else {
      await ctx.reply('Попробуйте ну прям чуть чуть попозже..')
    }


  } catch (e) {
    console.log(`Error while text message`, e.message)
  }
})
bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))