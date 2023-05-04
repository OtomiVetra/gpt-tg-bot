import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { openai } from './openai.js'
import { addUser } from './db.js'

console.log(config.get('TEST_ENV'))

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
  ctx.session = INITIAL_SESSION
  await ctx.reply('Жду голосовуху..')
})

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
  ctx.session ??= INITIAL_SESSION
  if (INITIAL_SESSION.messages.length > 20) {
    INITIAL_SESSION.messages.shift()
  }
  try {
    await ctx.reply(code('Соображаем маленечко...'))
    const userId = ctx.from.id;
    addUser(userId)
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