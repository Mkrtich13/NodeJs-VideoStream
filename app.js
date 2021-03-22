import Koa from 'koa'
import { extname, resolve } from 'path'
import { createReadStream, stat } from 'fs'
import { promisify } from 'util'
import jwt from 'koa-jwt'
import dotenv from 'dotenv'
dotenv.config()

const app = new Koa()

app.use(jwt({ 
  secret: process.env.JWT_SECRET, 
  algorithms: ['HS256', 'HS512'],
  getToken: ({ request }) => request.query.token
}))

app.use(async ({ request, response }, next) => {
  if (
    !request.url.startsWith('/api/video') ||
    !request.query.video ||
    !request.query.video.match(/^[a-z0-9-_ ]+\.(mp4|mov)$/i)
  ) {
    return next()
  }

  const range = request.header.range
  const video = resolve('videos', request.query.video)
  if (!range) {
    response.type = extname(video)
    response.body = createReadStream(video)
    return next()
  }

  const parts = range.replace('bytes=', '').split('-')
  const videoStat = await promisify(stat)(video)
  const start = parseInt(parts[0], 10)
  const end = parts[1] ? parseInt(parts[1], 10) : videoStat.size - 1

  response.set('Content-Range', `bytes ${start}-${end}/${videoStat.size}`)
  response.set('Accept-Ranges', 'bytes')
  response.set('Content-Lenght', end - start + 1)
  response.status = 206
  response.body = createReadStream(video, {start, end})

  return next()
})

app.on('error', (err, ctx) => {
  console.log('err', err)
})

app.listen(9000)