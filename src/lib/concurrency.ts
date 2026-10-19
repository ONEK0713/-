/**
 * 限并发地处理一组元素，结果顺序与输入一致。
 * 用来把“读标签”铺到 3–4 个 Worker 上，又不会一次性把 1000 个文件全读进内存。
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  const size = Math.max(1, Math.min(limit, items.length))
  let next = 0

  async function worker(): Promise<void> {
    for (;;) {
      const index = next
      next += 1
      if (index >= items.length) return
      const item = items[index]
      if (item === undefined) return
      results[index] = await task(item, index)
    }
  }

  await Promise.all(Array.from({ length: size }, () => worker()))
  return results
}
