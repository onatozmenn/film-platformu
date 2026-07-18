SELECT 'CREATE DATABASE film_platform_test OWNER film'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'film_platform_test')\gexec