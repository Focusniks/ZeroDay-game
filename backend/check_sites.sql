-- Проверка сайтов в базе данных
SELECT
    id,
    name,
    url,
    category,
    is_indexed,
    created_at
FROM browser_sites
ORDER BY category, name;

-- Проверка поискового индекса
SELECT
    bsi.id,
    bs.name as site_name,
    bsi.title,
    bsi.content,
    bsi.keywords,
    bsi.rank
FROM browser_search_index bsi
JOIN browser_sites bs ON bs.id = bsi.site_id
ORDER BY bsi.rank DESC, bsi.title;

-- Проверка: есть ли сайты без поискового индекса
SELECT
    bs.id,
    bs.name,
    bs.url,
    bs.is_indexed,
    CASE WHEN bsi.id IS NULL THEN 'NO INDEX' ELSE 'HAS INDEX' END as index_status
FROM browser_sites bs
LEFT JOIN browser_search_index bsi ON bsi.site_id = bs.id
ORDER BY bs.name;
