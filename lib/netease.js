/**
 * NetEase Cloud Music (网易云音乐) platform plugin.
 * 支持 JSON 格式 Cookie 解析与 VIP/高清音质解锁。
 */

import { createHash, createCipheriv } from 'node:crypto';

const eapiKey = 'e82ckenh8dichen8';

function aesEncrypt(buffer, mode, key, iv) {
	const cipher = createCipheriv(mode, key, iv);
	return Buffer.concat([cipher.update(buffer), cipher.final()]);
}

export function eapi(url, object) {
	const text = typeof object === 'object' ? JSON.stringify(object) : String(object);
	const message = `nobody${url}use${text}md5forencrypt`;
	const digest = createHash('md5').update(message).digest('hex');
	const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
	return {
		params: aesEncrypt(Buffer.from(data), 'aes-128-ecb', eapiKey, '')
			.toString('hex')
			.toUpperCase(),
	};
}

const WY_SEARCH_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
	Referer: 'https://music.163.com',
	origin: 'https://music.163.com',
};

const WY_URL_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
	Referer: 'https://music.163.com',
	origin: 'https://music.163.com',
	Cookie: 'os=pc',
};

const WY_LYRIC_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
	Referer: 'https://music.163.com',
	origin: 'https://music.163.com',
};

// 自动适配字符串 Cookie 或 JSON 对象格式的 Cookie
function formatCookie(rawCookie) {
	if (!rawCookie) return 'os=pc';
	let cookieStr = rawCookie.trim();
	
	if (cookieStr.startsWith('{')) {
		try {
			const obj = JSON.parse(cookieStr);
			cookieStr = Object.entries(obj)
				.map(([k, v]) => `${k}=${v}`)
				.join('; ');
		} catch (e) {
			console.warn('[netease] 解析 Cookie JSON 失败，将作为普通字符串处理', e);
		}
	}
	
	if (!cookieStr.includes('os=pc')) {
		cookieStr = `os=pc; ${cookieStr}`;
	}
	return cookieStr;
}

export async function searchNetEase(keyword, limit = 20) {
	const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=1&limit=${limit}`;
	const res = await fetch(url, { headers: WY_SEARCH_HEADERS, signal: AbortSignal.timeout(10000) });
	if (!res.ok) throw new Error(`网易云音乐搜索失败: HTTP ${res.status}`);
	const json = await res.json();
	if (json.code !== 200) throw new Error(`网易云音乐搜索接口异常: code=${json.code}`);
	const songs = json.result?.songs ?? [];
	return songs.map((s) => ({
		id: s.id,
		name: s.name,
		artist: s.artists?.map((a) => a.name).join('、') ?? '未知',
		album: s.album?.name ?? '',
		albumId: s.album?.id ?? 0,
		duration: Math.round(s.duration / 1000),
		cover: s.album?.picUrl ?? '',
	}));
}

export async function resolveNetEaseUrl(songId, loginCookie) {
	const formattedCookie = formatCookie(loginCookie);

	// 1. 优先使用带 Cookie 的官方接口解析 VIP / 高品质音频
	if (loginCookie) {
		try {
			const url = `https://music.163.com/api/song/enhance/player/url/v1?ids=${encodeURIComponent(`[${songId}]`)}&level=exhigh&encodeType=mp3`;
			const res = await fetch(url, {
				headers: { ...WY_URL_HEADERS, Cookie: formattedCookie },
				signal: AbortSignal.timeout(8000),
			});
			if (res.ok) {
				const json = await res.json();
				const item = json.data?.[0];
				if (item?.url) return item.url;
			}
		} catch (e) {}
	}

	// 2. 备用：Meting 镜像源
	try {
		const metingUrl = `https://api.injahow.cn/meting/?type=url&server=netease&id=${encodeURIComponent(String(songId))}`;
		const res = await fetch(metingUrl, {
			method: 'GET',
			redirect: 'manual',
			headers: { 'User-Agent': WY_SEARCH_HEADERS['User-Agent'] },
			signal: AbortSignal.timeout(8000),
		});
		if (res.status === 302 || res.status === 301) {
			const loc = res.headers.get('location');
			if (loc && loc.startsWith('http')) return loc;
		}
	} catch (e) {}

	// 3. 备用：官方接口
	try {
		const url = `https://music.163.com/api/song/enhance/player/url/v1?ids=${encodeURIComponent(`[${songId}]`)}&level=exhigh&encodeType=mp3`;
		const res = await fetch(url, { headers: { ...WY_URL_HEADERS, Cookie: formattedCookie }, signal: AbortSignal.timeout(8000) });
		if (res.ok) {
			const json = await res.json();
			const item = json.data?.[0];
			if (item?.url) return item.url;
		}
	} catch (e) {}

	throw new Error(`网易云音乐无法解析播放链接 (songId=${songId})`);
}

export async function fetchNetEaseLyric(songId) {
	const url = `https://music.163.com/api/song/lyric?id=${encodeURIComponent(String(songId))}&lv=1&kv=1&tv=-1`;
	const res = await fetch(url, { headers: WY_LYRIC_HEADERS, signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`网易云歌词获取失败: HTTP ${res.status}`);
	const json = await res.json();
	if (!json.lrc?.lyric) throw new Error(`网易云未返回歌词 (songId=${songId})`);
	return json.lrc.lyric;
}
