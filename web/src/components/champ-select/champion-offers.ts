import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ChampSelectState, default as ChampSelect } from "./champ-select";
import Root from "../root/root";

/**
 * Full-screen overlay shown at the start of modern ARAM games, where the
 * player is offered a small set of champions (usually 2-3) and picks one by
 * simply tapping its card.
 */
@Component
export default class ChampionOffers extends Vue {
    $root: Root;
    $parent: ChampSelect;

    @Prop()
    state: ChampSelectState;

    /**
     * @returns the champion ids currently offered to the local player
     */
    get offeredChampions(): number[] {
        const details = this.$parent.championDetails || {};

        // The client's subset list is the source of truth when present.
        const subset = (this.$parent.subsetChampionIds || []).filter(x => !!details[x]);
        if (subset.length > 0) return subset;

        // Fallback for bench modes where the pickable list is already small.
        if (!this.state || !this.state.benchEnabled) return [];
        const pickable = (this.$parent.pickableChampionIds || []).filter(x => !!details[x]);
        return pickable.length <= 6 ? pickable : [];
    }

    /**
     * @returns whether the offers overlay should currently be visible: bench
     * (ARAM-like) mode, a pending pick action for us, and a small offer set.
     */
    get visible(): boolean {
        if (!this.state) return false;
        if (!this.$parent.hasPendingAction) return false;

        const offers = this.offeredChampions;
        return offers.length > 0 && offers.length <= 6;
    }

    /**
     * Picks the tapped champion: assigns it to our pending action and locks it in.
     */
    pick(championId: number) {
        const act = this.$parent.getActions(this.state.localPlayer);
        if (!act || act.completed) return;

        // Modern clients lock in an action by PATCHing it with completed: true.
        this.$root.request("/lol-champ-select/v1/session/actions/" + act.id, "PATCH", JSON.stringify({ championId, completed: true }));

        // Older clients use a separate complete endpoint. Harmless if it 404s.
        this.$root.request("/lol-champ-select/v1/session/actions/" + act.id + "/complete", "POST");
    }

    /**
     * @returns the name of the specified champion
     */
    getChampionName(id: number): string {
        const details = this.$parent.championDetails[id];
        return details ? details.name : "";
    }

    /**
     * @returns the css style showing the specified champion's splash art
     */
    getChampionStyle(id: number): string {
        const details = this.$parent.championDetails[id];
        if (!details) return "";

        return `background-image: url(https://cdn.communitydragon.org/latest/champion/${details.key}/splash-art/centered), url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${details.id}_0.jpg)`;
    }
}
