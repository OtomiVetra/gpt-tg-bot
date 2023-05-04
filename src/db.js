import Nedb from 'nedb';
const db = new Nedb({ filename: './data.db', autoload: true })


export const addUser = (userId) => {
  db.insert({ name: 'John', age: 30, userId }, (err, doc) => {
    // Обработка ошибок или обработка результата insert
  });
}