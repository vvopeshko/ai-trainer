import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'

export async function GET(context) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate - a.data.pubDate
  )
  return rss({
    title: 'AI Trainer — блог',
    description: 'Про самостоятельные тренировки в зале и то, как мы делаем AI-тренера.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
    })),
    customData: '<language>ru</language>',
  })
}
