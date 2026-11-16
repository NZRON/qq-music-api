import * as credential from './api/credential.js';
import * as refresh from './api/refresh.js';
import * as search from './api/search.js';
import * as songUrl from './api/song/url.js';
import * as songDetail from './api/song/detail.js';
import * as cover from './api/cover.js';
import * as lyric from './api/lyric.js';
import * as album from './api/album.js';
import * as playlist from './api/playlist.js';
import * as singer from './api/singer.js';
import * as top from './api/top.js';
import {
	parseCredential,
	ensureCredentialTable,
	getCredentialFromDB,
	saveCredentialToDB,
} from './lib/credential.js';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

const routes = {
	'/api/credential': credential,
	'/api/refresh': refresh,
	'/api/search': search,
	'/api/song/url': songUrl,
	'/api/song/detail': songDetail,
	'/api/song/cover': cover,
	'/api/lyric': lyric,
	'/api/album': album,
	'/api/playlist': playlist,
	'/api/singer': singer,
	'/api/top': top,
};

const loginHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>登录 - QQ Music API</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0;min-height:100vh;display:flex;justify-content:center;align-items:center}
        .box{background:#222;padding:40px;border-radius:12px;width:100%;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,0.5);text-align:center}
        h1{font-size:1.5rem;color:#fff;margin-bottom:10px}
        p{color:#888;font-size:0.9rem;margin-bottom:24px}
        input{width:100%;padding:12px;margin-bottom:16px;background:#181818;border:1px solid #333;border-radius:6px;color:#fff;font-size:1rem}
        input:focus{border-color:#31c27c;outline:none}
        button{width:100%;padding:12px;background:#31c27c;border:none;border-radius:6px;color:#000;font-weight:600;font-size:1rem;cursor:pointer}
        button:hover{background:#28a96b}
        .err{color:#ff4444;font-size:0.85rem;margin-bottom:12px;display:none}
    </style>
</head>
<body>
<div class="box">
    <h1>QQ Music API</h1>
    <p>请输入管理员密码登录后查看</p>
    <div id="err" class="err">密码错误</div>
    <form id="form">
        <input type="password" id="pwd" placeholder="请输入密码" required autofocus>
        <button type="submit">登录</button>
    </form>
</div>
<script>
localStorage.clear();
sessionStorage.clear();

document.getElementById('form').onsubmit = async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('pwd').value;
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
    });
    if(res.ok){
        window.location.replace('/?t=' + Date.now());
    } else {
        document.getElementById('err').style.display = 'block';
    }
};
</script>
</body>
</html>`;

async function getAdminHtml(env) {
	let dbStatus = '❌ 未绑定';
	let credentialStatus = env.INITIAL_CREDENTIAL ? '✅ 已设置' : '❌ 未设置';
	let initResult = '⏳ 检查中...';
	let currentMusicId = '未知';

	if (env.DB) {
		dbStatus = '✅ 已绑定';
		try {
			await ensureCredentialTable(env.DB);
			const cred = await getCredentialFromDB(env.DB);
			if (cred && cred.musicid) {
				initResult = '✅ 数据库已有有效凭证';
				currentMusicId = cred.musicid;
			} else if (env.INITIAL_CREDENTIAL) {
				const initial = parseCredential(env.INITIAL_CREDENTIAL);
				if (initial) {
					await saveCredentialToDB(env.DB, initial);
					initResult = '✅ 凭证已从环境变量初始化到数据库';
					currentMusicId = initial.musicid;
				}
			} else {
				initResult = '⚠️ 数据库为空，请在下方更新凭证';
			}
		} catch (err) {
			initResult = `❌ 数据库初始化异常: ${err.message}`;
		}
	} else {
		initResult = '❌ D1 数据库未绑定 (DB)';
	}

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QQ Music API 管理与文档</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0;line-height:1.6}
        .c{max-width:800px;margin:0 auto;padding:40px 20px}
        h1{font-size:2rem;color:#fff;margin-bottom:8px}
        .s{color:#666;margin-bottom:30px}
        h2{font-size:1.1rem;color:#31c27c;margin:30px 0 15px;border-bottom:1px solid #333;padding-bottom:8px}
        .e{background:#222;border-radius:8px;padding:16px;margin-bottom:16px}
        .h{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .m{background:#31c27c;color:#000;padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:600}
        .p{font-family:monospace;color:#4facfe}
        .d{color:#999;font-size:.9rem;margin-bottom:12px}
        table{width:100%;border-collapse:collapse;font-size:.85rem}
        th{text-align:left;color:#666;font-weight:500;padding:6px 0}
        td{padding:6px 0;border-top:1px solid #333}
        .pm{font-family:monospace;color:#f0a020}
        .r{color:#f44;font-size:.75rem}
        .ex{background:#181818;padding:10px;border-radius:4px;font-family:monospace;font-size:.85rem;color:#aaa;margin-top:10px}
        .top-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
        .logout-btn{background:#333;color:#ff4444;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem}
        .logout-btn:hover{background:#444}
        .status-box{background:#222;border-radius:8px;padding:20px;margin-bottom:30px}
        .status-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #333;font-size:0.9rem}
        .status-row:last-child{border:none}
        .label{color:#888}
        .value{font-family:monospace}
        textarea{width:100%;height:100px;background:#181818;border:1px solid #333;border-radius:6px;color:#fff;padding:10px;font-family:monospace;font-size:0.85rem;margin-top:10px;margin-bottom:10px}
        textarea:focus{border-color:#31c27c;outline:none}
        .update-btn{background:#31c27c;color:#000;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer}
        .update-btn:hover{background:#28a96b}
        #msg{margin-top:10px;font-size:0.85rem;color:#31c27c}
        footer{margin-top:50px;text-align:center;color:#444;font-size:.85rem}
        a{color:#31c27c;text-decoration:none}
    </style>
</head>
<body>
<div class="c">
    <div class="top-bar">
        <h1>QQ Music API 管理与文档</h1>
        <button class="logout-btn" onclick="logout()">退出登录</button>
    </div>
    <p class="s">基于 Cloudflare Workers + D1 的 QQ 音乐 API 服务</p>

    <!-- D1 数据库状态与凭证更新面板 -->
    <h2>数据库与凭证管理</h2>
    <div class="status-box">
        <div class="status-row">
            <span class="label">D1 数据库绑定</span>
            <span class="value">${dbStatus}</span>
        </div>
        <div class="status-row">
            <span class="label">INITIAL_CREDENTIAL 变量</span>
            <span class="value">${credentialStatus}</span>
        </div>
        <div class="status-row">
            <span class="label">当前生效 QQ 号</span>
            <span class="value">${currentMusicId}</span>
        </div>
        <div class="status-row" style="border-top:1px solid #333; margin-top:8px; padding-top:8px;">
            <span class="label">状态说明</span>
            <span class="value" style="color:#aaa">${initResult}</span>
        </div>

        <div style="margin-top: 20px;">
            <label style="font-size:0.9rem; color:#aaa;">在线更新凭证 JSON：</label>
            <textarea id="credJson" placeholder="在此粘贴新的凭证 JSON 数据..."></textarea>
            <button class="update-btn" onclick="updateCredential()">保存并更新凭证</button>
            <span id="msg"></span>
        </div>
    </div>

    <!-- 完整 API 文档部分 -->
    <h2>搜索</h2>
    <div class="e">
        <div class="h"><span class="m">GET</span><span class="p">/api/search</span></div>
        <p class="d">搜索歌曲、歌手、专辑或歌单</p>
        <table>
            <tr><th>参数</th><th>类型</th><th>说明</th></tr>
            <tr><td><span class="pm">keyword</span><span class="r">*</span></td><td>string</td><td>搜索关键词</td></tr>
            <tr><td><span class="pm">type</span></td><td>string</td><td>song/singer/album/playlist</td></tr>
            <tr><td><span class="pm">num</span></td><td>int</td><td>返回数量</td></tr>
            <tr><td><span class="pm">page</span></td><td>int</td><td>页码</td></tr>
        </table>
        <div class="ex">GET /api/search?keyword=周杰伦&type=song&num=20</div>
    </div>

    <h2>歌曲</h2>
    <div class="e">
        <div class="h"><span class="m">GET</span><span class="p">/api/song/url</span></div>
        <p class="d">获取歌曲播放链接</p>
        <table>
            <tr><th>参数</th><th>类型</th><th>说明</th></tr>
            <tr><td><span class="pm">mid</span><span class="r">*</span></td><td>string</td><td>歌曲MID，多个用逗号分隔</td></tr>
            <tr><td><span class="pm">quality</span></td><td>string</td><td>128/320/flac</td></tr>
        </table>
        <div class="ex">GET /api/song/url?mid=0039MnYb0qxYhV&quality=320</div>
    </div>

    <div class="e">
        <div class="h"><span class="m">GET</span><span class="p">/api/song/detail</span></div>
        <p class="d">获取歌曲详情</p>
        <div class="ex">GET /api/song/detail?mid=0039MnYb0qxYhV</div>
    </div>

    <div class="e">
        <div class="h"><span class="m">GET</span><span class="p">/api/song/cover</span></div>
        <p class="d">获取歌曲封面</p>
        <div class="ex">GET /api/song/cover?mid=0039MnYb0qxYhV&size=300</div>
    </div>

    <h2>歌词与专辑/歌单/歌手/排行榜</h2>
    <div class="e"><div class="h"><span class="m">GET</span><span class="p">/api/lyric</span></div><p class="d">获取歌词：GET /api/lyric?mid=xxx</p></div>
    <div class="e"><div class="h"><span class="m">GET</span><span class="p">/api/album</span></div><p class="d">获取专辑：GET /api/album?mid=xxx</p></div>
    <div class="e"><div class="h"><span class="m">GET</span><span class="p">/api/playlist</span></div><p class="d">获取歌单：GET /api/playlist?id=xxx</p></div>
    <div class="e"><div class="h"><span class="m">GET</span><span class="p">/api/singer</span></div><p class="d">获取歌手：GET /api/singer?mid=xxx</p></div>
    <div class="e"><div class="h"><span class="m">GET</span><span class="p">/api/top</span></div><p class="d">获取排行：GET /api/top</p></div>

    <footer>QQ Music API Service</footer>
</div>
<script>
async function logout(){
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch(e) {}

    localStorage.clear();
    sessionStorage.clear();

    document.cookie = "admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=" + window.location.pathname + ";";

    window.location.replace("/?t=" + Date.now());
}

async function updateCredential(){
    const text = document.getElementById('credJson').value.trim();
    const msg = document.getElementById('msg');
    if(!text){
        msg.style.color = '#ff4444';
        msg.innerText = '请先输入凭证 JSON 内容';
        return;
    }
    try {
        const data = JSON.parse(text);
        const res = await fetch('/api/admin/credential', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if(res.ok){
            msg.style.color = '#31c27c';
            msg.innerText = '✅ 凭证更新成功！页面即将刷新...';
            setTimeout(() => location.reload(), 1500);
        } else {
            msg.style.color = '#ff4444';
            msg.innerText = '❌ 更新失败: ' + (json.error || '未知错误');
        }
    } catch(e){
        msg.style.color = '#ff4444';
        msg.innerText = '❌ JSON 格式错误，请检查输入';
    }
}
</script>
</body>
</html>`;
}

function isAuthenticated(request, env) {
	if (!env.ADMIN_PASSWORD) {
		return true;
	}
	const cookieHeader = request.headers.get('Cookie') || '';
	const match = cookieHeader.match(/admin_token=([^;]+)/);
	if (match && match[1] === env.ADMIN_PASSWORD) {
		return true;
	}
	return false;
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}
		if (path === '/api/logout') {
			return new Response(JSON.stringify({ success: true }), {
				headers: {
					'Content-Type': 'application/json',
					'Set-Cookie':
						'admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict',
					'Cache-Control': 'no-store, no-cache, must-revalidate',
					...corsHeaders,
				},
			});
		}
		if (path === '/api/login' && request.method === 'POST') {
			try {
				const body = await request.json();
				if (
					env.ADMIN_PASSWORD &&
					body.password === env.ADMIN_PASSWORD
				) {
					return new Response(JSON.stringify({ success: true }), {
						headers: {
							'Content-Type': 'application/json',
							'Set-Cookie': `admin_token=${env.ADMIN_PASSWORD}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
							'Cache-Control': 'no-store',
							...corsHeaders,
						},
					});
				}
			} catch (e) {}
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});
		}
		if (path === '/api/admin/credential' && request.method === 'POST') {
			if (!isAuthenticated(request, env)) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders,
					},
				});
			}
			if (!env.DB) {
				return new Response(
					JSON.stringify({ error: 'D1 database not bound' }),
					{
						status: 503,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders,
						},
					}
				);
			}
			try {
				const body = await request.json();
				const credentialData = body.credential || body;
				if (!credentialData.musicid || !credentialData.musickey) {
					return new Response(
						JSON.stringify({ error: '缺少 musicid 或 musickey' }),
						{
							status: 400,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders,
							},
						}
					);
				}
				await ensureCredentialTable(env.DB);
				const credential = parseCredential(
					JSON.stringify(credentialData)
				);
				if (!credential) {
					return new Response(
						JSON.stringify({ error: '凭证格式无效' }),
						{
							status: 400,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders,
							},
						}
					);
				}
				await saveCredentialToDB(env.DB, credential);
				return new Response(
					JSON.stringify({ success: true, message: '凭证已更新' }),
					{
						status: 200,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders,
						},
					}
				);
			} catch (err) {
				return new Response(JSON.stringify({ error: err.message }), {
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders,
					},
				});
			}
		}
		const authed = isAuthenticated(request, env);
		if (path === '/' || path === '/index.html' || path === '/admin') {
			if (!authed) {
				return new Response(loginHtml, {
					headers: {
						'Content-Type': 'text/html; charset=utf-8',
						'Cache-Control': 'no-store, no-cache, must-revalidate',
						...corsHeaders,
					},
				});
			}
			const html = await getAdminHtml(env);
			return new Response(html, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control':
						'no-store, no-cache, must-revalidate, proxy-revalidate',
					...corsHeaders,
				},
			});
		}
		if (path === '/login') {
			if (authed) {
				return Response.redirect(url.origin + '/', 302);
			}
			return new Response(loginHtml, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'no-store, no-cache, must-revalidate',
					...corsHeaders,
				},
			});
		}
		if (path.startsWith('/api/') && !authed) {
			return new Response(
				JSON.stringify({ error: 'Unauthorized, please login first' }),
				{
					status: 401,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders,
					},
				}
			);
		}
		const handler = routes[path];
		if (handler && handler.onRequest) {
			return handler.onRequest({ request, env, ctx });
		}
		return new Response(JSON.stringify({ error: 'Not Found' }), {
			status: 404,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders,
			},
		});
	},
	async scheduled(event, env, ctx) {
		await refresh.onSchedule({ env, ctx });
	},
};
