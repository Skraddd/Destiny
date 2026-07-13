<template>
    <transition enter-active-class="fadeIn" leave-active-class="fadeOut">
        <div class="champion-offers" v-if="visible">
            <span class="title">Choose Your Champion</span>

            <div class="offers">
                <div class="offer" v-for="id in offeredChampions" :key="id" @click="pick(id)">
                    <div class="offer-art" :style="getChampionStyle(id)"></div>
                    <span class="offer-name">{{ getChampionName(id) }}</span>
                </div>
            </div>
        </div>
    </transition>
</template>

<script lang="ts" src="./champion-offers.ts"></script>

<style lang="stylus" scoped>
    .fadeIn, .fadeOut
        animation-duration 0.3s !important

    .champion-offers
        position absolute
        top 0
        left 0
        right 0
        bottom 0
        z-index 10500
        background rgba(0, 0, 0, 0.88)
        display flex
        flex-direction column
        align-items center
        justify-content center

    .title
        color #f0e6d2
        font-family "LoL Display Bold"
        font-size 46px
        letter-spacing 0.06em
        text-transform uppercase
        margin-bottom 40px
        text-align center
        padding 0 20px

    .offers
        display flex
        flex-direction row
        justify-content center
        align-items stretch
        width 100%
        padding 0 20px
        box-sizing border-box

    .offer
        flex 1
        max-width 260px
        margin 0 12px
        border 2px solid #785a28
        background #010a13
        display flex
        flex-direction column
        overflow hidden

        &:active
            border-color #f0e6d2

    .offer-art
        width 100%
        height 340px
        background-size cover
        background-position center top

    .offer-name
        color #f0e6d2
        font-family "LoL Display Bold"
        font-size 30px
        letter-spacing 0.05em
        text-align center
        padding 16px 8px
        text-transform uppercase
</style>
