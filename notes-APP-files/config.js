// ============================================================
// Supabase 配置
// 请替换为你自己项目的 URL 和 anon public key
// 可在 Supabase 控制台 -> Project Settings -> API 中找到
// ============================================================
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
