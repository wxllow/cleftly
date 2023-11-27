<script lang="ts">
    import Fuse from 'fuse.js';
    import { Avatar } from '@skeletonlabs/skeleton';
    import db, { type FriendlyTrack } from '$lib/db';
    import { playTrack } from '$lib/player';
    import { _ } from 'svelte-i18n';

    let inputRef: HTMLInputElement;
    let resRef: HTMLDivElement;
    let search = '';
    let active = false;
    let res: FriendlyTrack[] = [];
    let tracks: FriendlyTrack[] = [];

    function unfocused(e?: MouseEvent) {
        // If target is parent of inputRef or resRef, return
        if (e && (inputRef.contains(e.target) || resRef.contains(e.target)))
            return;

        active = false;
        window.removeEventListener('click', unfocused);
    }

    async function updateSearch() {
        if (!search) return (active = false);

        active = true;

        if (tracks.length < 1) {
            tracks = await Promise.all(
                (
                    await db.tracks.toArray()
                ).map(async (track) => await db.friendlyTrack(track))
            );
        }

        const options = {
            keys: [
                {
                    name: 'title',
                    weight: 1
                },
                {
                    name: 'artist.name',
                    weight: 0.5
                },
                {
                    name: 'album.name',
                    weight: 0.5
                }
            ],
            shouldSort: true
        };

        const fuse = new Fuse(tracks, options);

        res = fuse.search(search).map((item) => item.item);

        window.addEventListener('click', unfocused);
    }
</script>

<div class="flex flex-col w-2/4 items-center justify-center">
    <input
        class="input rounded-lg p-1"
        type="text"
        placeholder={$_('search')}
        bind:this={inputRef}
        bind:value={search}
        on:input={updateSearch}
    />
    {#if inputRef && active}
        <div
            class="absolute card w-full max-w-sm max-h-48 p-4 overflow-y-auto"
            tabindex="-1"
            style="top: {inputRef.clientHeight + 16}px;"
            bind:this={resRef}
        >
            <ul class="list-nav text-sm">
                {#each res as item}
                    <button
                        on:click={async () => {
                            unfocused();
                            await playTrack(item);
                        }}
                        class="w-full"
                    >
                        <Avatar
                            src={item.album.albumArt}
                            class="p-0 m-0 w-8 h-8 rounded-lg"
                            initials={item.album.name.slice(0, 2)}
                        />
                        <div>
                            <p class="line-clamp-1">
                                {item.title}
                            </p>
                            <p class="line-clamp-1">
                                {item.artist.name}
                            </p>
                        </div>
                    </button>
                {/each}
            </ul>
        </div>
    {/if}
</div>