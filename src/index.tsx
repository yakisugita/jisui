import { Hono } from 'hono'
import { appendTrailingSlash } from 'hono/trailing-slash'
import { basicAuth } from 'hono/basic-auth'
import { env } from 'hono/adapter'
import type { FC } from 'hono/jsx'
import { Database } from 'bun:sqlite';
import { serveStatic } from 'hono/bun'
// https://yaakai.to/note/92
// DBカラム
// content内にjsonで各データを持つ 場所1,場所2,本文(Markdown)
// posts (id, date, title, content_public, content_private, created_at, updated_at, is_private)
// recipes (id, title, content, created_at, updated_at, is_private)
// 画像は1つの投稿のみに対応する。複数の画像の並べ替えのために順番を持つ
// images (id, post_id, recipe_id, order_num, created_at, updated_at, is_private)

// 期間を指定して記事を探す 古い順に並べる
function getPostsByDateRange(startDate: string, endDate: string) {
  console.log("startDate:", startDate, "endDate:", endDate)

  const query = db.query(`SELECT * FROM posts WHERE datetime BETWEEN DATETIME($start) AND DATETIME($end) ORDER BY datetime ASC`)
  const posts = query.all({ start: startDate, end: endDate })

  return posts
}

// YYYY-MM-DDTHH:MM:SS形式にする
function formatDateTime(date: Date): string {
  const isoDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60 * 1000,
  )
  .toISOString()
  .slice(0, 19)

  return isoDate
}

// DBの結果から表示用コンポーネントに変換
function withSameDateCount(posts: any[]): any[] {
  const resultPosts = []
  // 重複カウント
  let lastDate = ''
  let sameDateCount = 0
  for (const post of posts) {
    if (post.datetime.slice(0, 10) === lastDate) {
      sameDateCount++
    } else {
      sameDateCount = 0
    }
    resultPosts.push({ ...post, sameDateCount })
    lastDate = post.datetime.slice(0, 10) // 日付部分だけを比較するためにスライス
  }
  return resultPosts
}

const db = new Database("mydb.sqlite", { create: true, strict: true });
// テーブルがなければ作る
db.run('CREATE TABLE IF NOT EXISTS posts (id UUID, datetime datetime, title TEXT, content_public TEXT, content_private TEXT, created_at datetime, updated_at datetime, is_private BOOLEAN)')
db.run('CREATE TABLE IF NOT EXISTS recipes (id UUID, title TEXT, content TEXT, created_at datetime, updated_at datetime, is_private BOOLEAN)')
db.run('CREATE TABLE IF NOT EXISTS images (id UUID, post_id UUID, recipe_id UUID, order_num INTEGER, created_at datetime, updated_at datetime, is_private BOOLEAN)')

const app = new Hono()

// JSX
const Layout: FC = (props) => {
  return (
    <html>
      <body>{props.children}</body>
    </html>
  )
}

const PostList: FC<{ posts: Array<{ datetime: string; title: string; sameDateCount: number }>; title: string }> = (props: {
  posts: Array<{ datetime: string; title: string; sameDateCount: number }>
  title: string
}) => {
  return (
    <Layout>
      <h1>{props.title}</h1>
      <ul>
        {props.posts.map((post) => {
          return <li>{post} {post.datetime} - {post.title} (同日投稿{post.sameDateCount}件目)</li>
        })}
      </ul>
    </Layout>
  )
}

const Page: FC<{ post: { datetime: string; title: string; content_public: string; content_private: string; is_private: boolean } }> = (props) => {
  return (
    <Layout>
      <h1>{props.post.title}</h1>
      <p>{props.post.datetime}</p>
      <div>{props.post.content_public}</div>
      {props.post.is_private && <div>この投稿は非公開です。</div>}
    </Layout>
  )
}

// 末尾スラッシュありで統一
app.use('*', appendTrailingSlash())

// トップページ
// とりあえず静的ファイルで対応、あとでjsxにする
app.use('/', serveStatic({ path: './public/index.html' }))
// 最近の投稿、投稿カレンダー、などなど

//   return c.text('TOP PAGE')
// })

// posts
// 料理の投稿(外食含む)
// YYYY/MM/DD/0(連番) 時刻が早い方から0～数字を振る
// 内部uuidも持つ
app.get('/posts/:yyyy/', (c) => {
  const { yyyy } = c.req.param()
  
  const posts = getPostsByDateRange(formatDateTime(new Date(`${yyyy}-01-01T00:00:00`)), formatDateTime(new Date(`${yyyy}-12-31T23:59:59`)))
  return c.html(<PostList posts={withSameDateCount(posts)} title={`:calender: - ${yyyy}年`} />)
})

app.get('/posts/:yyyy/:mm/', (c) => {
  const { yyyy, mm } = c.req.param()

  const posts = getPostsByDateRange(formatDateTime(new Date(`${yyyy}-${mm}-01T00:00:00`)), formatDateTime(new Date(`${yyyy}-${mm}-31T23:59:59`)))
  return c.html(<PostList posts={withSameDateCount(posts)} title={`:calender: - ${yyyy}年${mm}月`} />)
})

app.get('/posts/:yyyy/:mm/:dd/', (c) => {
  const { yyyy, mm, dd } = c.req.param()

  const posts = getPostsByDateRange(formatDateTime(new Date(`${yyyy}-${mm}-${dd}T00:00:00`)), formatDateTime(new Date(`${yyyy}-${mm}-${dd}T23:59:59`)))
  return c.html(<PostList posts={withSameDateCount(posts)} title={`:calender: - ${yyyy}年${mm}月${dd}日`} />)
})

app.get('/posts/:yyyy/:mm/:dd/:number', (c) => {
  const { yyyy, mm, dd, number } = c.req.param()

  const query = db.query(`SELECT * FROM posts WHERE datetime BETWEEN DATETIME($start) AND DATETIME($end) ORDER BY datetime ASC LIMIT 1 OFFSET $offset`)
  const post = query.get({ start: formatDateTime(new Date(`${yyyy}-${mm}-${dd}T00:00:00`)), end: formatDateTime(new Date(`${yyyy}-${mm}-${dd}T23:59:59`)), offset: parseInt(number) })
  console.log(post)

  if (!post) {
    return c.text(`404 Not Found`, 404)
  }
  
  return c.html(<Page post={post} />)
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
    // if (!postData || !postData.public || !postData.private || !postData.datetime || !postData.title || !postData.is_private) {
    //   return c.status(400)
    // }
    // TODO 型をよく考える
    // Basic認証かけてあるのでjson型チェックは簡易でOK TODO:あとでちゃんとやる
    // 項目チェック

    const postDataPublic = JSON.stringify(postData.public)
    const postDataPrivate = JSON.stringify(postData.private)
    const postDatetime = formatDateTime(new Date(postData.datetime))

    // データをDBに保存する処理をここに追加
    db.run("INSERT INTO posts (id, datetime, title, content_public, content_private, created_at, updated_at, is_private) VALUES (?, DATETIME(?), ?, ?, ?, DATETIME(?), DATETIME(?), ?)",
      crypto.randomUUID(),
      postDatetime,
      postData.title,
      postDataPublic,
      postDataPrivate,
      formatDateTime(new Date()),
      formatDateTime(new Date()),
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
