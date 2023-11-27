<script lang="ts">
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { Loader2 } from 'lucide-svelte';
    import { onMount } from 'svelte';
    import db, { type FriendlyAlbum, type FriendlyTrack } from '$lib/db';
    import { friendlyLibrary, updateLibrary } from '$lib/library';
    import CreatePlaylist from '$components/CreatePlaylist.svelte';
    import Album from '$components/Album.svelte';
    import Track from '$components/Track.svelte';
    import { _ } from 'svelte-i18n';

    const toastStore = getToastStore();
    let albums: FriendlyAlbum[] = [];
    let recentlyAdded: FriendlyTrack[] = [];
    let loading = true;

    onMount(async () => {
        try {
            await updateLibrary();
            recentlyAdded = await friendlyLibrary(
                await db.tracks
                    .orderBy('createdAt')
                    .reverse()
                    .limit(16)
                    .toArray()
            );

            albums = await Promise.all(
                (
                    await db.albums
                        .orderBy('createdAt')
                        .reverse()
                        .limit(16)
                        .toArray()
                ).map(async (album) => await db.friendlyAlbum(album))
            );
            loading = false;
        } catch (e) {
            toastStore.trigger({
                message: `<h1 class="text-lg">Failed to load library</h1><p class="text-sm">${e}</p>`,
                background: 'variant-filled-error',
                autohide: false
            });
        }
    });
</script>

<div>
    <div class="flex justify-between">
        <h1 class="text-3xl mt-4 mb-8 justify-start">{$_('good_evening')}</h1>
        <CreatePlaylist />
    </div>
    <div class="space-y-4">
        <h2 class="text-xl">{$_('recently_played')}</h2>

        <h2 class="text-xl">{$_('recently_added')}</h2>
        <div class="flex space-x-4 {!loading ? 'overflow-y-auto' : ''}">
            {#if loading}
                <Loader2 class="animate-spin " />
                <p>{$_('updating_your_library')}...</p>
            {/if}
            {#each recentlyAdded as track}
                <Track {track} titleClamp={1} view="artist" />
            {/each}
        </div>
        <h2 class="text-xl">{$_('albums')}</h2>
        <div class="flex space-x-4 {!loading ? 'overflow-y-auto' : ''}">
            {#each albums as album}
                <Album titleClamp={1} {album} />
            {/each}
        </div>
        <h2 class="text-xl">{$_('playlists')}</h2>

        <h2 class="text-xl">{$_('artists')}</h2>
    </div>
</div>