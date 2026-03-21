-- Migration: 010_update_site_domains.sql
-- Обновление доменных имен сайтов: .network для хостингов, провайдеров, криптокошельков
-- zerogram.com для мессенджера

-- Обновляем URLs для хостингов (.network)
UPDATE browser_sites SET 
    url = 'https://cloudpro.network',
    description = 'Профессиональный хостинг для ваших проектов'
WHERE url = 'zeroday://hosting/cloudpro';

UPDATE browser_sites SET 
    url = 'https://fasthost.network',
    description = 'Быстрый и надежный хостинг'
WHERE url = 'zeroday://hosting/fasthost';

UPDATE browser_sites SET 
    url = 'https://securehost.network',
    description = 'Безопасный хостинг с шифрованием'
WHERE url = 'zeroday://hosting/securehost';

UPDATE browser_sites SET 
    url = 'https://budgethost.network',
    description = 'Доступный хостинг для начинающих'
WHERE url = 'zeroday://hosting/budgethost';

-- Обновляем URLs для провайдеров (.network)
UPDATE browser_sites SET 
    url = 'https://freenet.network',
    description = 'Бесплатный доступ в сеть ZeroDay'
WHERE url = 'zeroday://isp/freenet';

UPDATE browser_sites SET 
    url = 'https://speedmax.network',
    description = 'Высокоскоростной интернет провайдер'
WHERE url = 'zeroday://isp/speedmax';

UPDATE browser_sites SET 
    url = 'https://homenet.network',
    description = 'Домашний интернет провайдер'
WHERE url = 'zeroday://isp/homenet';

UPDATE browser_sites SET 
    url = 'https://fiberoptic.network',
    description = 'Оптоволоконный интернет нового поколения'
WHERE url = 'zeroday://isp/fiberoptic';

-- Обновляем URL для криптокошелька (.network)
UPDATE browser_sites SET 
    url = 'https://cryptowallet.network',
    description = 'Безопасный криптокошелек для ZeroDay'
WHERE url = 'zeroday://crypto';

-- Обновляем URL для мессенджера (zerogram.com)
UPDATE browser_sites SET 
    url = 'https://zerogram.com',
    name = 'Zerogram',
    description = 'Современный мессенджер ZeroDay'
WHERE url = 'zeroday://messenger';

-- Обновляем поисковый индекс для новых URLs
UPDATE browser_search_index si
SET title = bs.name,
    updated_at = NOW()
FROM browser_sites bs
WHERE si.site_id = bs.id;
