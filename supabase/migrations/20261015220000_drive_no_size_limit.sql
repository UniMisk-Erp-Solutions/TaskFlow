-- No per-bucket size cap for Files: the only limit left is the storage service's global
-- upload limit (UPLOAD_FILE_SIZE_LIMIT).
UPDATE storage.buckets SET file_size_limit = NULL WHERE id = 'taskflow-files';
