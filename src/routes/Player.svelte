<script lang="ts">
    /**
     *
     */
    import {
        RangeSlider,
        getModalStore,
        getToastStore
    } from '@skeletonlabs/skeleton';
    import {
        Shuffle,
        StepBack,
        Pause,
        StepForward,
        Repeat,
        Play,
        Repeat1,
        TextSelect,
        ListMusic,
        Settings
    } from 'lucide-svelte';

    import { _ } from 'svelte-i18n';
    import { playTrack } from '$lib/player';
    import { audio, front, player, queue } from '$lib/stores';
    import { getTimestamp } from '$lib/utils';
    import { eventManager } from '$lib/events';
    import { openTrackMenu } from '$lib/menus';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    audio.subscribe(async (value) => {
        if (!navigator.mediaSession) {
            return;
        }

        if (!value?.track) {
            navigator.mediaSession.metadata = null;
            return;
        }

        navigator.mediaSession.metadata = new MediaMetadata({
            title: value.track.title,
            artist: value.track.artist.name,
            album: value.track.album.name,
            artwork: value.track.album.albumArt
                ? [
                      {
                          src: value.track.album.albumArt
                      }
                  ]
                : []
        });

        navigator.mediaSession.setActionHandler('previoustrack', previous);
        navigator.mediaSession.setActionHandler('nexttrack', next);
        navigator.mediaSession.setActionHandler('seekto', (e) => {
            if ($audio) {
                $audio.currentTime = e.seekTime || 0;

                fireTrackChange().then(() => {});
            }
        });
    });

    function onEnd() {
        next();
    }

    async function next() {
        if (!$audio) {
            return;
        }

        if ($queue.index === $queue.tracks.length - 1) {
            if ($player.repeat === 'all') {
                await playTrack($queue.tracks[0], $queue.tracks);
            }

            return;
        }

        const next = $queue.tracks[$queue.index + 1];

        if (!next) return;

        await playTrack(next, $queue.tracks, $queue.index + 1);
    }

    async function previous() {
        if (!$audio) return;

        if ($audio.currentTime > 3) {
            $audio.currentTime = 0;
            return;
        }

        if ($queue.index === 0) return;

        const prev = $queue.tracks[$queue.index - 1];

        if (!prev) return;

        await playTrack(prev, $queue.tracks, $queue.index - 1);
    }

    async function shuffleTracks() {
        // Shuffle the queue
        let shuffled = $queue.tracks
            .slice($queue.index + 1)
            .map((value) => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);

        queue.set({
            ...$queue,
            unshuffled: $queue.tracks,
            index: 0,
            tracks: [
                $queue.tracks[$queue.index],
                ...shuffled,
                ...$queue.tracks.slice(0, $queue.index)
            ]
        });
    }

    function error() {
        if (navigator.mediaSession) {
            navigator.mediaSession.metadata = null;
        }

        toastStore.trigger({
            message: `<h1 class="text-lg">${$_(
                'track_play_failure'
            )}</h1> <p class="text-sm">${$_('unknown', {
                values: {
                    path: $audio?.track.location
                }
            })}</p>`,
            background: 'variant-filled-error'
        });
    }

    async function fireTrackChange() {
        eventManager
            .fireEvent('on_track_change', $audio)
            .then(() => {})
            .catch((err) => {
                console.error(err);
                console.error('Failed to fire event on_track_change');
            });
    }
</script>

{#if $audio}
    {#if $audio.backend === 'web'}
        <audio
            src={$audio.src}
            class="hidden"
            autoplay
            bind:this={$player.webAudioElement}
            bind:paused={$player.paused}
            on:pause={fireTrackChange}
            on:play={async () => {
                await fireTrackChange();
            }}
            on:seeked={fireTrackChange}
            bind:muted={$player.muted}
            bind:currentTime={$audio.currentTime}
            bind:duration={$audio.duration}
            bind:volume={$player.volume}
            bind:playbackRate={$player.speed}
            on:ended={onEnd}
            on:error={error}
            loop={$player.repeat === 'one'}
        />
    {/if}

    <div
        class="flex bg-neutral-300 dark:bg-neutral-900 h-[5.5rem] overflow-hidden w-full"
    >
        <div
            class="w-1/3 lg:w-1/4 flex items-center space-x-2 ml-2"
            on:contextmenu={async (e) => {
                await openTrackMenu(e, $audio.track, modalStore, toastStore);
            }}
            role="button"
            tabindex="0"
        >
            <img
                src={$audio.track.album.albumArt}
                class="w-[4.5rem] h-[4.5rem] rounded-lg"
                alt="Album Art"
            />
            <div class="items-center">
                <h1 class="text-sm line-clamp-2">
                    {$audio.track.title || $_('unknown')}
                </h1>
                <h2 class="text-xs line-clamp-2">
                    <a
                        class="anchor no-underline"
                        href="/library/album?id={encodeURIComponent(
                            $audio.track.album.id
                        )}"
                    >
                        {$audio.track.album.name ||
                            $audio.track.title ||
                            $_('unknown')}</a
                    >
                    -
                    <a
                        class="anchor no-underline"
                        href="/library/artist?id={encodeURIComponent(
                            $audio.track.artist.id
                        )}">{$audio.track.artist.name || $_('unknown')}</a
                    >
                </h2>
            </div>
            <!-- <AddToPlaylist tracks={[$audio.track]} /> -->
        </div>
        <div
            class="w-1/3 lg:w-2/4 flex flex-col items-center space-y-4 mx-4 justify-center"
        >
            <div class="flex items-center space-x-4 w-full">
                <p class="text-xs">{getTimestamp($audio.currentTime)}</p>

                <RangeSlider
                    name="currentTime"
                    accent="variant-filled-primary"
                    class="w-full"
                    bind:value={$audio.currentTime}
                    max={Math.floor($audio.track.duration || $audio.duration)}
                    step={1}
                />
                <p class="text-xs">
                    {getTimestamp($audio.track.duration || $audio.duration)}
                </p>
            </div>
            <div class="flex items-center space-x-2">
                <button
                    class="btn btn-sm variant-soft w-4 h-4 p-0"
                    on:click={() => {
                        if ($queue.unshuffled) {
                            queue.set({
                                ...$queue,
                                index: Math.max(
                                    0,
                                    $queue.unshuffled
                                        ? $queue.unshuffled.findIndex(
                                              (t) => t.id === $audio?.track.id
                                          )
                                        : -1
                                ),
                                tracks: $queue.unshuffled,
                                unshuffled: null
                            });
                        } else {
                            shuffleTracks();
                        }
                    }}
                >
                    <Shuffle
                        class={$queue.unshuffled ? 'stroke-primary-500' : ''}
                    />
                </button>
                <button
                    class="btn btn-sm variant-soft w-6 h-6 p-0"
                    on:click={previous}
                >
                    <StepBack />
                </button>
                <button
                    class="btn btn-sm variant-soft w-6 h-6 p-0"
                    on:click={() => ($player.paused = !$player.paused)}
                >
                    {#if $player.paused}
                        <Play />
                    {:else}
                        <Pause />
                    {/if}
                </button>
                <button
                    class="btn btn-sm variant-soft w-6 h-6 p-0"
                    on:click={next}
                >
                    <StepForward />
                </button>
                <button
                    class="btn btn-sm variant-soft w-4 h-4 p-0"
                    on:click={() => {
                        switch ($player.repeat) {
                            case 'all':
                                $player.repeat = 'one';
                                break;
                            case 'one':
                                $player.repeat = false;
                                break;
                            default:
                                $player.repeat = 'all';
                                break;
                        }
                    }}
                >
                    {#if $player.repeat === 'one'}
                        <Repeat1 class="stroke-primary-500" />
                    {:else}
                        <Repeat
                            class={$player.repeat ? 'stroke-primary-500' : ''}
                        />
                    {/if}
                </button>
            </div>
        </div>
        <div
            class="w-1/3 lg:w-1/4 flex items-center space-x-4 mr-8 justify-end"
        >
            <RangeSlider
                name="volume"
                bind:value={$player.volume}
                min={0}
                max={1}
                step={0.01}
            />
            <button
                class="btn btn-sm variant-soft w-6 h-6 p-0"
                on:click={() => {
                    $front.modal =
                        $front.modal === 'playerSettings'
                            ? null
                            : 'playerSettings';
                }}
            >
                <Settings
                    class={$front.modal === 'playerSettings'
                        ? 'stroke-primary-500'
                        : undefined}
                />
            </button>
            <button
                class="btn btn-sm variant-soft w-6 h-6 p-0"
                on:click={() => {
                    $front.modal = $front.modal === 'queue' ? null : 'queue';
                }}
            >
                <ListMusic
                    class={$front.modal === 'queue'
                        ? 'stroke-primary-500'
                        : undefined}
                />
            </button>
            <button
                class="btn btn-sm variant-soft w-6 h-6 p-0"
                on:click={() => {
                    $front.modal = $front.modal === 'lyrics' ? null : 'lyrics';
                }}
            >
                <TextSelect
                    class={$front.modal === 'lyrics'
                        ? 'stroke-primary-500'
                        : undefined}
                />
            </button>
        </div>
    </div>
{/if}
