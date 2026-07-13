import Vue from "vue";
import Root, { Result } from "../root/root";
import { Component } from "vue-property-decorator";
import { ddragon, ddragonAsync, mapBackground, Role, summonerName } from "@/constants";

import Timer from "./timer.vue";
import Members from "./members.vue";
import PlayerSettings from "./player-settings.vue";
import SummonerPicker from "./summoner-picker.vue";
import ChampionPicker from "./champion-picker.vue";
import ChampionOffers from "./champion-offers.vue";
import RuneEditor from "./rune-editor.vue";
import Bench from "./bench.vue";
import SkinPicker from "./skin-picker.vue";

import MagicBackground from "../../static/magic-background.jpg";

export interface ChampSelectMember {
    assignedPosition: Role | ""; // blind pick has no role
    playerType: string; // either PLAYER or BOT
    cellId: number;
    championId: number;
    championPickIntent: number;
    selectedSkinId: number;
    displayName: string;
    summonerId: number;
    spell1Id: number;
    spell2Id: number;
    team: number;

    // added manually
    isFriendly: boolean;
}

export interface ChampSelectAction {
    id: number;
    actorCellId: number;
    championId: number;
    completed: boolean;
    type: "ban" | "pick" | "ten_bans_reveal"; // might be more types, only these two are used in conventional queues
}

// A 'turn' is simply an array of actions that happen at the same time.
// In blind pick, this is all the players picking. In draft pick, every
// turn only contains a single action (since no players pick at the same time).
export type ChampSelectTurn = ChampSelectAction[];

export interface ChampSelectTimer {
    phase: "PLANNING" | "BAN_PICK" | "FINALIZATION" | "GAME_STARTING"; // might be more
    isInfinite: boolean;
    adjustedTimeLeftInPhase: number; // time left in ms
}

export interface ChampSelectSwap {
    id: number;
    cellId: number;
    state: string; // AVAILABLE | BUSY | INVALID | RECEIVED | SENT | ACCEPTED | DECLINED | CANCELLED
}

export interface ChampSelectState {
    actions: ChampSelectTurn[];

    localPlayerCellId: number;
    localPlayer: ChampSelectMember; // added manually, not actually in the payload

    myTeam: ChampSelectMember[];
    theirTeam: ChampSelectMember[];

    timer: ChampSelectTimer;
    trades: {
        id: number;
        cellId: number;
        state: string; // this is an enum.
    };

    // Pick order swaps (swap your pick turn with a teammate).
    pickOrderSwaps: ChampSelectSwap[];

    // Position/role swaps (swap assigned position with a teammate).
    positionSwaps: ChampSelectSwap[];

    benchEnabled: boolean;
    benchChampions: { championId: number }[];
}

export interface GameflowState {
    map: { id: number };
    gameData: {
        queue: {
            gameMode: string;
            gameTypeConfig: {
                reroll: boolean;
            };
        };
    }
}

export interface RerollState {
    numberOfRolls: number;
    maxRolls: number;
}

export interface RunePage {
    id: number;
    name: string;
    isEditable: boolean;
    isActive: boolean;
    order: number;
    primaryStyleId: number; // -1 if not selected
    subStyleId: number; // -1 if not selected
    selectedPerkIds: number[]; // 0 or not included if not selected
}

export interface SkinItem {
    championId: number;
    id: number;
    name: string;
    isBase: boolean;
    disabled: boolean;
    ownership: {
        owned: boolean
    };
}

@Component({
    components: {
        timer: Timer,
        members: Members,
        playerSettings: PlayerSettings,
        summonerPicker: SummonerPicker,
        championPicker: ChampionPicker,
        championOffers: ChampionOffers,
        runeEditor: RuneEditor,
        bench: Bench,
        skinPicker: SkinPicker
    }
})
export default class ChampSelect extends Vue {
    $root: Root;

    state: ChampSelectState | null = null;
    gameflowState: GameflowState | null = null;
    rerollState: RerollState = { numberOfRolls: 0, maxRolls: 2 };

    runePages: RunePage[] = [];
    currentRunePage: RunePage | null = null;

    skins: SkinItem[] = [];
    pickingSkin = false;

    // These two are used to map summoner/champion id -> data.
    championDetails: { [id: number]: { id: string, key: string, name: string } } = {};
    summonerSpellDetails: { [id: number]: { id: string, key: string, name: string } };

    // Information for the summoner spell overlay.
    pickingSummonerSpell = false;
    pickingFirstSummonerSpell = false;

    // Information for the champion picker.
    pickingChampion = false;

    // Champion ids the local player is currently allowed to pick. Kept here
    // (single observer) and shared by the champion picker and the ARAM offers.
    pickableChampionIds: number[] = [];

    // Subset of champions for the modern ARAM initial selection (2-3 champions
    // to pick from). Empty when the mode has no subset pick.
    subsetChampionIds: number[] = [];

    // Information for the rune editor.
    showingRuneOverlay = false;

    // Information for the reroll bench.
    showingBench = false;

    mounted() {
        this.loadStatic("champion.json").then(map => {
            // map to { id: data }
            const details: any = {};
            Object.keys(map.data).forEach(x => details[+map.data[x].key] = map.data[x]);
            this.championDetails = details;
        });

        this.loadStatic("summoner.json").then(map => {
            // map to { id: data }
            const details: any = {};
            Object.keys(map.data).forEach(x => details[+map.data[x].key] = map.data[x]);
            this.summonerSpellDetails = details;
        });

        // Start observing champion select.
        this.$root.observe("/lol-champ-select/v1/session", this.handleChampSelectChange.bind(this));

        // Track which champions we can pick. Newer clients expose an id array,
        // older ones an object with a championIds property: handle both.
        const extractIds = (content: any): number[] => Array.isArray(content) ? content : (content && content.championIds) || [];

        this.$root.observe("/lol-champ-select/v1/pickable-champion-ids", result => {
            if (result.status !== 200) return;
            this.pickableChampionIds = extractIds(result.content);
        });

        this.$root.observe("/lol-champ-select/v1/pickable-champions", result => {
            if (result.status !== 200) return;
            this.pickableChampionIds = extractIds(result.content);
        });

        // Modern ARAM: the small subset of champions offered for the initial pick.
        this.$root.observe("/lol-lobby-team-builder/champ-select/v1/subset-champion-list", result => {
            this.subsetChampionIds = result.status === 200 && Array.isArray(result.content) ? result.content : [];
        });

        // Keep track of reroll points for if we play ARAM.
        this.$root.observe("/lol-summoner/v1/current-summoner/rerollPoints", result => {
            this.rerollState = result.status === 200 ? result.content : { numberOfRolls: 0, maxRolls: 2 };
        });

        // Observe runes
        this.$root.observe("/lol-perks/v1/pages", response => {
            response.status === 200 && (this.runePages = response.content);
            response.status === 200 && (this.runePages.sort((a, b) => a.order - b.order));
        });

        this.$root.observe("/lol-perks/v1/currentpage", response => {
            this.currentRunePage = response.status === 200 ? response.content : null;

            // Update the isActive param if needed.
            if (this.currentRunePage) {
                this.runePages.forEach(x => x.isActive = x.id === this.currentRunePage!.id);
            }
        });
    }

    /**
     * Handles a change to the champion select and updates the state appropriately.
     * Note: this cannot be an arrow function for various changes. See the lobby component for more info.
     */
    handleChampSelectChange = async function(this: ChampSelect, result: Result) {
        if (result.status !== 200) {
            this.state = null;
            return;
        }
        
        const newState: ChampSelectState = result.content;
        newState.localPlayer = newState.myTeam.filter(x => x.cellId === newState.localPlayerCellId)[0];

        // If we haven't loaded skins before, do so now.
        if (!this.skins.length) {
            const url = `/lol-champions/v1/inventories/${newState.localPlayer.summonerId}/skins-minimal`;
            this.skins = await this.$root.request(url).then(x => x.content);

            this.$root.observe(url, data => {
                this.skins = data.status === 200 ? data.content : []
            });
        }

        // For everyone on our team, request their summoner name.
        await Promise.all(newState.myTeam.map(async mem => {
            if (mem.playerType === "BOT") {
                mem.displayName = (this.championDetails[mem.championId] || { name: "Unknown" }).name + " Bot";
            } else {
                const summ = (await this.$root.request("/lol-summoner/v1/summoners/" + mem.summonerId)).content;
                mem.displayName = summonerName(summ);
            }
            mem.isFriendly = true;
        }));

        // Give enemy summoners obfuscated names, if we don't know their names
        newState.theirTeam.forEach((mem, idx) => {
            mem.displayName = "Summoner " + (idx + 1);
            mem.isFriendly = false;
        });

        // If we weren't in champ select before, fetch some data.
        if (!this.state) {
            // Gameflow, which contains information about the map and gamemode we are queued up for.
            this.$root.request("/lol-gameflow/v1/session").then(x => {
                x.status === 200 && (this.gameflowState = <GameflowState>x.content);
            });
        }

        const oldAction = this.state ? this.getActions(this.state.localPlayer) : undefined;
        this.state = newState;

        const newAction = this.getActions(this.state.localPlayer);
        // If we didn't have an action and have one now, or if the actions differ in id, present the champion picker.
        // Bench (ARAM-like) modes are excluded: there the on-screen champion
        // offers overlay handles the initial choice instead.
        const usesOffers = this.state.benchEnabled || this.subsetChampionIds.length > 0;
        if (!usesOffers && ((!oldAction && newAction) || (newAction && oldAction && oldAction.id !== newAction.id))) {
            this.pickingChampion = true;
        }
    };

    /**
     * @returns whether the current queue is Arena (map 30 / CHERRY)
     */
    get isArena(): boolean {
        if (!this.gameflowState || !this.gameflowState.map) return false;
        return this.gameflowState.map.id === 30 || (<any>this.gameflowState.map).gameMode === "CHERRY";
    }

    /**
     * @returns whether the local player has an uncompleted pick/ban action
     */
    get hasPendingAction(): boolean {
        if (!this.state) return false;
        const act = this.getActions(this.state.localPlayer);
        return !!act && !act.completed;
    }

    /**
     * @returns the map background for the current queue
     */
    get background(): string {
        if (!this.gameflowState) return "background-image: url(" + MagicBackground + ")";
        return mapBackground(this.gameflowState.map.id);
    }

    // TODO: Maybe unify the following two functions?
    /**
     * @returns the current turn happening, or null if no single turn is currently happening (pre and post picks)
     */
    get currentTurn(): ChampSelectTurn | null {
        if (!this.state || this.state.timer.phase !== "BAN_PICK") return null;
        // Find the first set of actions that has at least one not completed.
        return this.state.actions.filter(x => x.filter(y => !y.completed).length > 0)[0];
    }

    /**
     * @returns the next turn happening, or null if there is no next turn.
     */
    get nextTurn(): ChampSelectTurn | null {
        if (!this.state || this.state.timer.phase !== "BAN_PICK") return null;
        return this.state.actions.filter(x => x.filter(y => !y.completed).length > 0)[1];
    }

    /**
     * @returns the action in the current turn for the specified member, or null if the member can't do anything
     */
    getActions(member: ChampSelectMember, future = false): ChampSelectAction | null {
        const turn = future ? this.nextTurn : this.currentTurn;
        return turn ? turn.filter(x => x.actorCellId === member.cellId)[0] || null : null;
    }

    /**
     * @returns the member associated with the specified cellId
     */
    getMember(cellId: number): ChampSelectMember {
        if (!this.state) throw new Error("Shouldn't happen");
        return this.state.myTeam.filter(x => x.cellId === cellId)[0] || this.state.theirTeam.filter(x => x.cellId === cellId)[0];
    }

    /**
     * Selects the specified rune page, by setting its `current` property to true and calling the collections backend.
     */
    selectRunePage(event: Event) {
        const id = +(event.target as HTMLSelectElement).value;
        this.runePages.forEach(r => r.isActive = r.id === id);
        this.$root.request("/lol-perks/v1/currentpage", "PUT", "" + id);
    }

    /**
     * @returns whether the local summoner still needs to pick a champion or not
     */
    get hasLockedChampion(): boolean {
        return !!this.state // A state exists.
            && this.state.actions.filter(x => // and we cannot find a pick turn in which
                x.filter(y => // there exists an action...
                    y.actorCellId === this.state!.localPlayerCellId // by the current player
                    && y.type === "pick" // that has to pick a champion
                    && !y.completed // and hasn't been completed yet
                ).length > 0).length === 0;
    }

    /**
     * @returns whether everyone has picked their champion already
     */
    get hasEveryonePicked(): boolean {
        return !!this.state // A state exists.
            && this.state.actions.filter(x => // and we cannot find a pick turn in which
                x.filter(y => // there exists an action...
                    y.type === "pick" // that has to pick a champion
                    && !y.completed // and hasn't been completed yet
                ).length > 0).length === 0;
    }

    /**
     * Helper method to load the specified json name from the ddragon static data.
     */
    /**
     * @returns the swap entry of the given kind targeting the specified cell, if any
     */
    public getSwap(kind: "pickOrderSwaps" | "positionSwaps", cellId: number): ChampSelectSwap | null {
        const list = (this.state && this.state[kind]) || [];
        return list.filter(x => x.cellId === cellId)[0] || null;
    }

    /**
     * Requests a pick order or position swap with the specified teammate.
     */
    public requestSwap(kind: "pickOrderSwaps" | "positionSwaps", cellId: number) {
        const swap = this.getSwap(kind, cellId);
        if (!swap || swap.state !== "AVAILABLE") return;

        const endpoint = kind === "pickOrderSwaps" ? "pick-order-swaps" : "position-swaps";
        this.$root.request("/lol-champ-select/v1/session/" + endpoint + "/" + swap.id + "/request", "POST");
    }

    /**
     * @returns the first incoming swap request (someone asking us), if any
     */
    get incomingSwap(): { kind: "pickOrderSwaps" | "positionSwaps", swap: ChampSelectSwap } | null {
        if (!this.state) return null;

        for (const kind of <("pickOrderSwaps" | "positionSwaps")[]>["pickOrderSwaps", "positionSwaps"]) {
            const received = ((this.state[kind]) || []).filter(x => x.state === "RECEIVED")[0];
            if (received) return { kind, swap: received };
        }

        return null;
    }

    /**
     * Accepts or declines the current incoming swap request.
     */
    public answerSwap(accept: boolean) {
        const incoming = this.incomingSwap;
        if (!incoming) return;

        const endpoint = incoming.kind === "pickOrderSwaps" ? "pick-order-swaps" : "position-swaps";
        this.$root.request("/lol-champ-select/v1/session/" + endpoint + "/" + incoming.swap.id + "/" + (accept ? "accept" : "decline"), "POST");
    }

    /**
     * @returns the display name of the member in the given cell
     */
    public memberName(cellId: number): string {
        const member = (this.state ? this.state.myTeam.concat(this.state.theirTeam) : []).filter(x => x.cellId === cellId)[0];
        return member ? member.displayName : "a teammate";
    }

    public loadStatic(filename: string): Promise<any> {
        // Always resolve the latest ddragon version first, so runes/champions
        // reflect the current patch instead of a stale cached version.
        return ddragonAsync().then(version => new Promise(resolve => {
            const req = new XMLHttpRequest();
            req.onreadystatechange = () => {
                if (req.status !== 200 || !req.responseText || req.readyState !== 4) return;
                const map = JSON.parse(req.responseText);
                resolve(map);
            };
            req.open("GET", "https://ddragon.leagueoflegends.com/cdn/" + version + "/data/en_US/" + filename, true);
            req.send();
        }));
    }
}