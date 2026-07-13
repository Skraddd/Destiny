<template>
    <div class="champ-select" v-if="state && state.localPlayer" :style="background">
        <summoner-picker :state="state" :show="pickingSummonerSpell" :first="pickingFirstSummonerSpell" @close="pickingSummonerSpell = false"></summoner-picker>
        <champion-picker :state="state" :show="pickingChampion" @close="pickingChampion = false"></champion-picker>
        <champion-offers :state="state"></champion-offers>
        <bench :state="state" :show="showingBench" @close="showingBench = false"></bench>
        <skin-picker :state="state" :show="pickingSkin" @close="pickingSkin = false"></skin-picker>

        <div class="swap-request" v-if="incomingSwap">
            <span>{{ memberName(incomingSwap.swap.cellId) }} wants to swap {{ incomingSwap.kind === 'pickOrderSwaps' ? 'pick order' : 'role' }} with you.</span>
            <div class="swap-request-buttons">
                <div class="swap-answer accept" @click="answerSwap(true)">ACCEPT</div>
                <div class="swap-answer decline" @click="answerSwap(false)">DECLINE</div>
            </div>
        </div>

        <timer :state="state"></timer>
        <members :state="state"></members>
        <player-settings
            :state="state"
            @spell="(pickingSummonerSpell = true, pickingFirstSummonerSpell = $event)"
            @expand="pickingChampion = true"
            @runes="showingRuneOverlay = true"
            @bench="showingBench = true"
            @skins="pickingSkin = true">
        </player-settings>
        <rune-editor :show="showingRuneOverlay" @close="showingRuneOverlay = false"></rune-editor>

    </div>
</template>

<script lang="ts" src="./champ-select.ts"></script>

<style lang="stylus">
    body.has-notch .champ-select
        height 100vh
        box-sizing border-box

        padding-top calc(env(safe-area-inset-top) + 30px)
</style>

<style lang="stylus" scoped>
    @import "../../common.styl"

    .swap-request
        position absolute
        top 0
        left 0
        right 0
        z-index 11000
        background rgba(0, 0, 0, 0.9)
        border-bottom 2px solid #cdbe93
        color #f0e6d2
        font-family "LoL Body"
        font-size 28px
        padding calc(env(safe-area-inset-top) + 15px) 20px 15px 20px
        display flex
        flex-direction column
        align-items center

    .swap-request-buttons
        display flex
        margin-top 12px

    .swap-answer
        margin 0 10px
        padding 10px 30px
        border 1px solid #cdbe93
        font-family "LoL Display Bold"
        letter-spacing 0.05em

        &.accept
            color #0acbe6
            border-color #0acbe6

        &.decline
            color #c6403b
            border-color #c6403b

    .champ-select
        z-index 10000
        position absolute
        top 0
        left 0
        bottom 0
        right 0
        background-size cover
        background-repeat no-repeat
        display flex
        flex-direction column
</style>