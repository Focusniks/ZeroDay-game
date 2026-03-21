-- Проверка профилей в базе данных
SELECT 
    mp.messenger_id,
    mp.display_name,
    mp.about,
    u.username as user_username,
    u.email as user_email
FROM messenger_profiles mp
JOIN users u ON u.id = mp.user_id
ORDER BY mp.messenger_id;
