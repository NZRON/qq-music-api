/**
 * NetEase Cloud Music (网易云音乐) platform plugin.
 * 精准搜索修复版：强制单曲类型匹配，确保搜索结果准确无误。
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

const WY_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
	'Referer': 'https://music.163.com',
	'Origin': 'https://music.163.com',
};

function formatCookie(rawEnvValue) {
	if (!rawEnvValue) return 'os=pc; appver=8.9.70;';
	let cookieStr = String(rawEnvValue).trim();
	if (cookieStr.startsWith('{')) {
		try {
			const obj = JSON.parse(cookieStr);
			const targetObj = obj.netease || obj;
			cookieStr = Object.entries(targetObj)
				.map(([k, v]) => `${k}=${v}`)
				.join('; ');
		} catch (e) {}
	}
	if (!cookieStr.includes('os=pc')) {
		cookieStr = `os=pc; ${cookieStr}`;
	}
	return cookieStr;
}

// 1. 精准搜索单曲
export async function searchNetEase(keyword, limit = 20, envCredential) {
	const cookie = formatCookie(envCredential);
	// type=1 表示只搜索单曲，避免搜到杂七杂八的歌单或专辑
	const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=1&limit=${limit}&offset=0`;
	
	const res = await fetch(url, {
		method: 'GET',
		headers: { ...WY_HEADERS, 'Cookie': cookie },
		signal: AbortSignal.timeout(10000),
	});

	if (!res.ok) throw new Error(`网易云音乐搜索失败: HTTP ${res.status}`);
	const json = await res.json();
	if (json.code !== 200) throw new Error(`网易云音乐搜索接口异常: code=${json.code}`);
	
	const songs = json.result?.songs ?? [];
	return songs.map((s) => {
		// 兼容不同接口返回的艺术家字段 (artists 或 ar)
		const artists = s.artists || s.ar || [];
		// 兼容不同接口返回的专辑字段 (album 或 al)
		const album = s.album || s.al || {};
		
		return {
			id: s.id,
			name: s.name,
			artist: artists.map((a) => a.name).join('、') ?? '未知',
			album: album.name ?? '',
			albumId: album.id ?? 0,
			duration: Math.round((s.duration || s.dt || 0) / 1000),
			cover: album.picUrl || s.picUrl || '',
		};
	});
}

// 2. 播放链接解析
export async function resolveNetEaseUrl(songId, envCredential) {
	const formattedCookie = formatCookie(envCredential);
	if (envCredential) {
		try {
			const url = `https://music.163.com/api/song/enhance/player/url/v1?ids=${encodeURIComponent(`[${songId}]`)}&level=exhigh&encodeType=mp3`;
			const res = await fetch(url, { headers: { ...WY_HEADERS, Cookie: formattedCookie }, signal: AbortSignal.timeout(8000) });
			if (res.ok) {
				const json = await res.json();
				const item = json.data?.[0];
				if (item?.url) return item.url;
			}
		} catch (e) {}
	}
	try {
		const metingUrl = `https://api.injahow.cn/meting/?type=url&server=netease&id=${encodeURIComponent(String(songId))}`;
		const res = await fetch(metingUrl, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': WY_HEADERS['User-Agent'] }, signal: AbortSignal.timeout(8000) });
		if (res.status === 302 || res.status === 301) {
			const loc = res.headers.get('location');
			if (loc && loc.startsWith('http')) return loc;
		}
	} catch (e) {}
	throw new Error(`网易云音乐无法解析播放链接 (songId=${songId})`);
}

// 3. 歌词
export async function fetchNetEaseLyric(songId) {
	const url = `https://music.163.com/api/song/lyric?id=${encodeURIComponent(String(songId))}&lv=1&kv=1&tv=-1`;
	const res = await fetch(url, { headers: WY_HEADERS, signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`网易云歌词获取失败: HTTP ${res.status}`);
	const json = await res.json();
	if (!json.lrc?.lyric) throw new Error(`网易云未返回歌词`);
	return json.lrc.lyric;
}

// 4. 歌曲详情
export async function fetchNetEaseSongDetail(songIds) {
	const ids = Array.isArray(songIds) ? songIds : songIds.split(',');
	const url = `https://music.163.com/api/v3/song/detail?c=${encodeURIComponent(JSON.stringify(ids.map(id => ({ id: Number(id) }))))}`;
	const res = await fetch(url, { headers: WY_HEADERS, signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`获取歌曲详情失败`);
	const json = await res.json();
	return (json.songs ?? []).map(s => ({
		id: s.id,
		name: s.name,
		artist: s.ar?.map(a => a.name).join('、') ?? '',
		album: s.al?.name ?? '',
		albumId: s.al?.id ?? 0,
		duration: Math.round(s.dt / 1000),
		cover: s.al?.picUrl ?? ''
	}));
}

// 5. 专辑详情
export async function fetchNetEaseAlbum(albumId) {
	const url = `https://music.163.com/api/v1/album/${albumId}`;
	const res = await fetch(url, { headers: WY_HEADERS, signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`获取专辑详情失败`);
	const json = await res.json();
	const album = json.album || {};
	const songs = (json.songs || []).map(s => ({
		id: s.id,
		name: s.name,
		artist: s.ar?.map(a => a.name).join('、') ?? '',
		album: album.name,
		duration: Math.round(s.dt / 1000),
		cover: album.picUrl ?? ''
	}));
	return { album: { id: album.id, name: album.name, artist: album.artist?.name, cover: album.picUrl, publishTime: album.publishTime }, songs };
}

// 6. 歌单详情
export async function fetchNetEasePlaylist(playlistId) {
	const url = `https://music.163.com/api/v3/playlist/detail?id=${playlistId}`;
	const res = await fetch(url, { headers: WY_HEADERS, signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`获取歌单详情失败`);
	const json = await res.json();
	const pl = json.playlist || {};
	const tracks = (pl.tracks || []).map(s => ({
		id: s.id,
		name: s.name,
		artist: s.ar?.map(a => a.name).join('、') ?? '',
		album: s.al?.name ?? '',
		duration: Math.round(s.dt / 1000),
		cover: s.al?.picUrl ?? ''
	}));
	return { playlist: { id: pl.id, name: pl.name, description: pl.description, cover: pl.coverImgUrl, playCount: pl.playCount }, songs: tracks };
}

// 7. 歌手详情与热门歌曲
export async function fetchNetEaseSinger(artistId) {
	const url = `https://music.163.com/api/v1/artist/${artistId}`;
	const res = await fetch(url, { headers: WY_HEADERS, signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`获取歌手详情失败`);
	const json = await res.json();
	const artist = json.artist || {};
	const hotSongs = (json.hotSongs || []).map(s => ({
		id: s.id,
		name: s.name,
		artist: artist.name,
		album: s.al?.name ?? '',
		duration: Math.round(s.dt / 1000),
		cover: s.al?.picUrl ?? ''
	}));
	return { artist: { id: artist.id, name: artist.name, cover: artist.picUrl, musicSize: artist.musicSize, albumSize: artist.albumSize }, hotSongs };
}

// 8. 官方排行榜
export async function fetchNetEaseTopList() {
	const url = `https://music.163.com/api/toplist`;
	const res = await fetch(url, { headers: WY_HEADERS, signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`获取排行榜失败`);
	const json = await res.json();
	return (json.list || []).map(item => ({
		id: item.id,
		name: item.name,
		cover: item.coverImgUrl,
		updateFrequency: item.updateFrequency
	}));
}
