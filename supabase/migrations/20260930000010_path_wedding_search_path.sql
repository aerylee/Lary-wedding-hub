-- Security advisor (function_search_path_mutable): pin app.path_wedding's search_path.
-- It references no tables, so an empty search_path is both safe and sufficient.
alter function app.path_wedding(text) set search_path = '';
