import { Hono } from 'hono'
import { appendTrailingSlash } from 'hono/trailing-slash'
import { Database } from 'bun:sqlite';
// DBカラム
// content内にjsonで各データを持つ 場所1,場所2,本文(Markdown)
// posts (id, date, time, title, content, created_at, updated_at, is_private)
// recipes (id, title, content, created_at, updated_at, is_private)
// 画像は1つの投稿のみに対応する。複数の画像の並べ替えのために順番を持つ
// images (id, post_id, recipe_id, order, created_at, updated_at, is_private)
const db = new Database("mydb.sqlite", { create: true, strict: true });

const app = new Hono()

// 末尾スラッシュありで統一
app.use('*', appendTrailingSlash())

// トップページ
// 最近の投稿、投稿カレンダー、などなど
app.get('/', (c) => {
  return c.text('TOP PAGE')
})

// posts
// 料理の投稿(外食含む)
// YYYY/MM/DD/1(連番) 時刻が早い方から1～数字を振る
// YYYYのみを含むURLではその年の投稿一覧を表示する
// 内部uuidも持つ
app.get('/posts/:yyyy/', (c) => {
  const { yyyy } = c.req.param()
  // return c.text(`Post ID: ${id}`)
  return c.text(`投稿一覧 - ${yyyy}年`)
})
app.get('/posts/:yyyy/:mm/', (c) => {
  const { yyyy, mm } = c.req.param()
  // return c.text(`Post ID: ${id}`)
  return c.text(`投稿一覧 - ${yyyy}年${mm}月`)
})
app.get('/posts/:yyyy/:mm/:dd/', (c) => {
  const { yyyy, mm, dd } = c.req.param()
  // return c.text(`Post ID: ${id}`)
  return c.text(`投稿一覧 - ${yyyy}年${mm}月${dd}日`)
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

// 投稿
app.post('/posts', async (c) => {
  const data = await c.req.json()
  // データをDBに保存する処理をここに追加
  // 例: db.run("INSERT INTO posts (title, content) VALUES (?, ?)", data.title, data.content);
  return c.json({ message: 'Post created successfully', data })
})

// 画像投稿 S3互換ストレージに投げる
app.post('/images', async (c) => {
  const data = await c.req.json()
  // データをDBに保存する処理をここに追加
  // 例: db.run("INSERT INTO images (post_id, recipe_id, order) VALUES (?, ?, ?)", data.post_id, data.recipe_id, data.order);
  return c.json({ message: 'Image uploaded successfully', data })
})

export default app
