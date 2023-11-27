import type * as mm from 'music-metadata-browser';

import { get } from 'svelte/store';
import { invoke } from '@tauri-apps/api';
import { getToastStore } from '@skeletonlabs/skeleton';
import type { FriendlyTrack } from './db';

import { nowPlaying } from './integrations/lastfm';
import { getLyrics } from './lyrics';
import { getStreamUrl } from './utils';
import { getOrCreateConfig } from './config';
import { INITIAL_AUDIO, audio, queue } from '$lib/stores';

async function play(
    src: string,
    track: FriendlyTrack,
    queued?: FriendlyTrack[],
    queueIndex?: number,
    backend: 'native' | 'web' = 'native'
) {
    if (backend == 'native') {
        console.log(src);
        await invoke('play_audio', {
            filePath: src
        }).catch((e) => {
            const toastStore = getToastStore();

            toastStore.trigger({
                message: `<h1 class="text-lg">Failed to play track</h1> <p class="text-sm">Could not play track at ${src}</p>`,
                background: 'variant-filled-error'
            });
        });
    }

    audio.set({
        ...INITIAL_AUDIO,
        track,
        src: src,
        backend,
        playedAt: new Date()
    });
    queue.set({
        unshuffled: null,
        tracks: queued || [track],
        index:
            typeof queueIndex === 'number'
                ? queueIndex
                : Math.max(
                      0,
                      queued ? queued.findIndex((t) => t.id === track.id) : -1
                  )
    });

    getLyrics(track, track.location)
        .then((lyrics) => {
            const aud = get(audio);

            console.info(
                `Lyrics: ${lyrics ? 'Got' : "Didn't get"} lyrics`,
                lyrics
            );

            if (!lyrics || !aud) return;

            aud.lyrics = lyrics;
        })
        .catch((err) => {
            console.error(err);
            console.error('Failed to find lyrics');
        });

    nowPlaying(track)
        .then((res) => {
            if (res) {
                console.info('Last.FM: Now playing track', res.data);
            }
        })
        .catch((e) => {
            console.error(e);
            console.error('Last.FM: Failed to update now playing');
        });
}

export function parseMMMetadata(
    metadata: mm.IAudioMetadata,
    name: string = ''
) {
    return {
        title: metadata.common.title || name,
        artist: metadata.common.artist || 'Unknown Artist',
        album: metadata.common.album || 'Unknown Album',
        albumArt:
            metadata.common.picture && metadata.common.picture.length > 0
                ? new Blob([metadata.common.picture[0].data], {
                      type: metadata.common.picture[0].format
                  })
                : '',
        genres: metadata.common.genre || [],
        year: metadata.common.year,
        trackNum: metadata.common.track.no || 1,
        totalTracks: metadata.common.track.of || 1,
        duration: metadata.format.duration || 0,
        format: {
            bitrate: metadata.format.bitrate || 0,
            loseless: metadata.format.lossless || false,
            codec: metadata.format.codec,
            codecProfile: metadata.format.codecProfile
        }
    };
}

export async function playTrack(
    track: FriendlyTrack,
    queued?: FriendlyTrack[],
    index?: number
) {
    const backend = (await getOrCreateConfig()).audio_backend;

    if (backend === 'web') {
        const streamUrl = await getStreamUrl(track.location);

        await play(streamUrl, track, queued, index, backend);
    } else {
        await play(track.location, track, queued, index, backend);
    }
}

export async function syncCycle() {}