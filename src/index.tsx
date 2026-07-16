import { Hono } from 'hono'
import { appendTrailingSlash } from 'hono/trailing-slash'
import { basicAuth } from 'hono/basic-auth'
import { env } from 'hono/adapter'
import { Database } from 'bun:sqlite';
import { serveStatic } from 'hono/bun'

// https://yaakai.to/note/92
// DBカラム
// content内にjsonで各データを持つ 場所1,場所2,本文(Markdown)
// posts (id, date, title, content_public, content_private, created_at, updated_at, is_private)
// recipes (id, title, content, created_at, updated_at, is_private)
// 画像は1つの投稿のみに対応する。複数の画像の並べ替えのために順番を持つ
// images (id, post_id, recipe_id, order_num, created_at, updated_at, is_private)
const db = new Database("mydb.sqlite", { create: true, strict: true });
// テーブルがなければ作る
db.run('CREATE TABLE IF NOT EXISTS posts (id UUID, datetime datetime, title TEXT, content_public TEXT, content_private TEXT, created_at datetime, updated_at datetime, is_private BOOLEAN)')
db.run('CREATE TABLE IF NOT EXISTS recipes (id UUID, title TEXT, content TEXT, created_at datetime, updated_at datetime, is_private BOOLEAN)')
db.run('CREATE TABLE IF NOT EXISTS images (id UUID, post_id UUID, recipe_id UUID, order_num INTEGER, created_at datetime, updated_at datetime, is_private BOOLEAN)')

const app = new Hono()

// 末尾スラッシュありで統一
app.use('*', appendTrailingSlash())

// トップページ
// 最近の投稿、投稿カレンダー、などなど
app.get('/', (c) => {
  // 投稿をすべて取得してログ出力
  db.query('SELECT * FROM posts').all().forEach((row) => {
    console.log(row)
  })

  return c.text('TOP PAGE')
})

// posts
// 料理の投稿(外食含む)
// YYYY/MM/DD/1(連番) 時刻が早い方から1～数字を振る
// 内部uuidも持つ
app.get('/posts/:yyyy/', (c) => {
  const { yyyy } = c.req.param()
  // return c.text(`Post ID: ${id}`)
  // YYYY/01/01～YYYY/12/31までの投稿を取得して表示する
  return c.text(`:calendar: - ${yyyy}年`)
})
app.get('/posts/:yyyy/:mm/', (c) => {
  const { yyyy, mm } = c.req.param()
  // return c.text(`Post ID: ${id}`)
  return c.text(`:calendar: - ${yyyy}年${mm}月`)
})
app.get('/posts/:yyyy/:mm/:dd/', (c) => {
  const { yyyy, mm, dd } = c.req.param()
  // return c.text(`Post ID: ${id}`)
  return c.text(`:calendar: - ${yyyy}年${mm}月${dd}日`)
})
app.get('/posts/:yyyy/:mm/:dd/:number', (c) => {
  const { yyyy, mm, dd, number } = c.req.param()
  // return c.text(`Post ID: ${id}`)
  return c.text(`投稿を表示 - ${yyyy}年${mm}月${dd}日, 通し番号: ${number}`)
})

// recipes
// 料理レシピ
// 任意のID
app.get('/recipes/:id', (c) => {
  const { id } = c.req.param()
  // return c.text(`Post ID: ${id}`)
  return c.text(`レシピを表示 - ID: ${id}`)
})

// 画像表示
app.get('/images/:id', (c) => {
  const { id } = c.req.param()
  // return c.text(`Post ID: ${id}`)
  return c.text(`画像を表示 - ID: ${id}`)
})

// 投稿 Basic認証をかける 認証情報は.envに書く
app.post('/posts', 
  basicAuth({
    verifyUser: (username, password, c) => {
      const { AUTH_USER, AUTH_PASSWORD } = env<{ AUTH_USER: string, AUTH_PASSWORD: string }>(c)
      return ( username === AUTH_USER && password === AUTH_PASSWORD)
    },
  }),
  async (c) => {
    const postData = await c.req.json()
    console.log(postData)
    if (!postData || !postData.public || !postData.private || !postData.datetime || !postData.title || !postData.is_private) {
      return c.status(400)
    }
    // TODO 型をよく考える
    // Basic認証かけてあるのでjson型チェックは簡易でOK TODO:あとでちゃんとやる
    // 項目チェック

    const postDataPublic = JSON.stringify(postData.public)
    const postDataPrivate = JSON.stringify(postData.private)
    const postDatetime = new Date(postData.datetime).toISOString()
    // データをDBに保存する処理をここに追加
    // 例: db.run("INSERT INTO posts (title, content) VALUES (?, ?)", data.title, data.content);
    db.run("INSERT INTO posts (id, datetime, title, content_public, content_private, created_at, updated_at, is_private) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      postDatetime,
      postData.title,
      postDataPublic,
      postDataPrivate,
      new Date().toISOString(),
      new Date().toISOString(),
      postData.is_private
    )
    return c.json({ message: 'Post created successfully', data: postData })
})

// 画像投稿 S3互換ストレージに投げる
app.post('/images', async (c) => {
  const data = await c.req.json()
  // データをDBに保存する処理をここに追加
  // 例: db.run("INSERT INTO images (post_id, recipe_id, order_num) VALUES (?, ?, ?)", data.post_id, data.recipe_id, data.order_num);
  return c.json({ message: 'Image uploaded successfully', data })
})

export default app
