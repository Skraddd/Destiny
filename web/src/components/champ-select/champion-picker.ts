import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ChampSelectAction, ChampSelectState, default as ChampSelect } from "./champ-select";
import Root from "../root/root";
import { ddragon } from "../../constants";

@Component
export default class ChampionPicker extends Vue {
    $root: Root;
    $parent: ChampSelect;

    @Prop()
    state: ChampSelectState;

    @Prop()
    show: boolean;


    searchTerm = "";

    /**
     * @returns the list of champion ids currently "selectable"
     */
    get selectableChampions(): number[] {
        if (!this.state) return [];
        const details = this.$parent.championDetails || {};

        // Derive "are we banning" from the exact same source as the header,
        // so the grid and the header can never disagree.
        const act = this.$parent.getActions(this.state.localPlayer);
        const isCurrentlyBanning = !!(act && act.type === "ban" && !act.completed);

        const allActions = (<ChampSelectAction[]>[]).concat(...this.state.actions);
        const bannedChamps = allActions.filter(x => x.type === "ban" && x.completed).map(x => x.championId);

        // During bans, any champion in the game can be banned (owned or not),
        // so use the full roster instead of relying on the client's bannable
        // list, which is unreliable on modern patches. During picks, use the
        // pickable list from the client.
        const source = isCurrentlyBanning
            ? Object.keys(details).map(x => +x)
            : (this.$parent.subsetChampionIds.length > 0 ? this.$parent.subsetChampionIds : this.$parent.pickableChampionIds);

        return source
            .filter(x => details[x] && bannedChamps.indexOf(x) === -1)
            .filter(x => details[x].name.toLowerCase().includes(this.searchTerm.toLowerCase()))
            .sort((a, b) => details[a].name.localeCompare(details[b].name));
    }

    /**
     * @returns the header shown at the top of the prompt
     */
    get header(): string {
        const act = this.$parent.getActions(this.state.localPlayer);
        if (!act && this.firstUncompletedPickAction) return "Declare Your Champion!";
        if (!act || act.type !== "ban") return "Pick a Champion";
        return "Ban a Champion";
    }

    /**
     * @returns the type of the finish button
     */
    get buttonType(): string {
        const act = this.$parent.getActions(this.state.localPlayer);
        if (!act || act.type !== "ban") return "confirm";
        return "deny";
    }

    /**
     * @returns the text of the finish button
     */
    get buttonText(): string {
        const act = this.$parent.getActions(this.state.localPlayer);
        if (!act || act.type !== "ban") return "Pick!";
        return "Ban!";
    }

    /**
     * @returns if we can complete the current action (e.g. lock in or ban)
     */
    get canCompleteAction(): boolean {
        const act = this.$parent.getActions(this.state.localPlayer);
        return !!(act && !act.completed && this.selectedChampion);
    }

    /**
     * @returns the id of the champion currently selected or hovered
     */
    get selectedChampion(): number {
        const act = this.$parent.getActions(this.state.localPlayer);
        if (act) return act.championId;

        const firstUncompletedPick = this.firstUncompletedPickAction;
        if (firstUncompletedPick) return firstUncompletedPick.championId;

        return 0;
    }

    /**
     * Gets the first uncompleted pick action for the current player,
     * or undefined if there is no such action.
     */
    get firstUncompletedPickAction(): ChampSelectAction | undefined {
        const allActions: ChampSelectAction[] = Array.prototype.concat(...this.state.actions);
        return allActions.filter(x => x.type === "pick" && x.actorCellId === this.state.localPlayerCellId && !x.completed)[0];
    }

    /**
     * Selects the specified champion for the current action.
     */
    selectChampion(championId: number) {
        const act = this.$parent.getActions(this.state.localPlayer);
        if (!act) return this.hoverChampion(championId);
        this.$root.request("/lol-champ-select/v1/session/actions/" + act.id, "PATCH", JSON.stringify({ championId }));
    }

    /**
     * Hovers the specified champion, by changing the champion of
     * the first uncompleted pick action for the current player.
     * Does nothing if there is no action to pick for.
     */
    hoverChampion(championId: number) {
        const firstUncompletedPick = this.firstUncompletedPickAction;
        if (!firstUncompletedPick) return;
        this.$root.request("/lol-champ-select/v1/session/actions/" + firstUncompletedPick.id, "PATCH", JSON.stringify({ championId }));
    }

    /**
     * Completes the current action and dismisses the picker.
     */
    completeAction() {
        const act = this.$parent.getActions(this.state.localPlayer)!;
        const championId = act.championId || this.selectedChampion;

        // Modern clients lock in an action by PATCHing it with completed: true.
        this.$root.request("/lol-champ-select/v1/session/actions/" + act.id, "PATCH", JSON.stringify({ championId, completed: true }));

        // Older clients use a separate complete endpoint. Harmless if it 404s.
        this.$root.request("/lol-champ-select/v1/session/actions/" + act.id + "/complete", "POST");

        this.$emit("close");
    }

    /**
     * @returns the path to the icon of the specified champion
     */
    getChampionImage(id: number) {
        if (!this.$parent.championDetails[id]) return "";

        return "https://ddragon.leagueoflegends.com/cdn/" + ddragon() + "/img/champion/" + this.$parent.championDetails[id].id + ".png";
    }

    /**
     * @returns the name for the specified champion
     */
    championName(id: number) {
        const entry = this.$parent.championDetails[id];
        return entry ? entry.name : "???";
    }
}