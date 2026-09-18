/**
 * 数据库查询辅助
 */

/**
 * 分页拉取一个查询的全部结果
 *
 * 小程序端单次 get() 上限 20 条，需要全量统计（如驾驶舱）时必须走这个。
 * 只要计数不要明细的场景优先用 count()，它不受 20 条限制。
 *
 * ⚠️ 用 skip 分页，统计场景可接受；有并发写入时可能漏读或重读，不要用于精确对账。
 *
 * @param {object} query - 已构造好 where/orderBy 的查询对象
 * @param {{pageSize?:number, maxPages?:number}} [options]
 * @returns {Promise<Array>}
 */
async function fetchAll(query, options) {
  const pageSize = (options && options.pageSize) || 20;
  const maxPages = (options && options.maxPages) || 50;
  const all = [];

  for (let i = 0; i < maxPages; i++) {
    // 小程序端 query 对象不可变，每次链式调用派生新对象，循环里重复调用是安全的
    const res = await query.skip(i * pageSize).limit(pageSize).get();
    all.push(...res.data);
    if (res.data.length < pageSize) break;
  }

  return all;
}

module.exports = { fetchAll };
