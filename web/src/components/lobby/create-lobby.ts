import Vue from "vue";
import Component from "vue-class-component";
import Root from "../root/root";

/**
 * Represents a game queue. These are shown based on availability and category.
 */
interface GameQueue {
    category: string;
    gameMode: string;
    description: string;
    id: number;
    queueAvailability: string;
    mapId: number;
}

type MappedQueueList = { [key: string]: GameQueue[] };

/**
 * Quick note: All the logic for displaying which queues where is ripped directly from
 * the League client. If the logic seems dodgy or spaghetti, you know who to blame. <3
 *
 * Note that we only show PVP modes. Adding in a tabbing system for the few people that
 * do bots is a bit excessive, especially considering the slow queue time. Maybe if people
 * show interest.
 */
@Component({ })
export default class CreateLobby extends Vue {
    $root: Root;

    iconPaths: { [key: string]: string } = {};
    enabledGameQueues: number[] = [];
    defaultGameQueues: number[] = [];
    queues: GameQueue[] = [];

    selectedSection = "";
    selectedQueueId = 0;

    created() {
        // Prepare icon paths.
        // Note that even though promises are used, these all resolve synchronously.
        for (const map of ["sr", "ha", "tt", "tft", "rgm"]) {
            import(/* webpackMode: "eager" */ `../../static/maps/${map}-default.png`).then(result => {
                this.iconPaths[map + "-default"] = result.default;
            });

            import(/* webpackMode: "eager" */ `../../static/maps/${map}-active.png`).then(result => {
                this.iconPaths[map + "-active"] = result.default;
            });
        }
    }

    mounted() {
        // Helper function to return to the first queue of the first map if
        // the set of available queues changes. This is easier than diffing and
        // checking if the current queue is still available, and it is very
        // unlikely that queues will change while the user is active anyway.
        const resetCurrentSelection = () => {
            if (!this.sections.length) {
                this.selectedSection = "";
                this.selectedQueueId = 0;
                return;
            }

            // Queues changed, update
            this.selectedSection = this.sections[0];
            this.selectedQueueId = this.availableQueues[this.selectedSection][0].id;
        };

        // Observe enabled and default game queues.
        this.$root.observe("/lol-platform-config/v1/namespaces/LcuSocial/EnabledGameQueues", data => {
            this.enabledGameQueues = data.status === 200 ? data.content.split(",").map((x: string) => +x) : [];
            resetCurrentSelection();
        });

        // Observe enabled and default game queues.
        this.$root.observe("/lol-platform-config/v1/namespaces/LcuSocial/DefaultGameQueues", data => {
            this.defaultGameQueues = data.status === 200 ? data.content.split(",").map((x: string) => +x) : [];
            resetCurrentSelection();
        });

        // Update queue maps.
        this.$root.observe("/lol-game-queues/v1/queues", data => {
            this.queues = data.status === 200 ? data.content : [];
            resetCurrentSelection();
        });
    }

    /**
     * Sorts queues by mapId-gameMode, limited to only the queues that are actually
     * available. Also only recomputed if its dependencies change.
     */
    get availableQueues(): MappedQueueList {
        const ret: MappedQueueList = {};

        // Collect queues. We deliberately do NOT gate on the legacy
        // LcuSocial/EnabledGameQueues config: on modern clients it does not
        // list newer modes (Swiftplay, Arena, ARAM variants, TFT, ...).
        // The platform's own availability flag is the source of truth; the
        // enabled/default lists are only used below for sort priority.
        const seen: { [id: number]: boolean } = {};
        for (const queue of this.queues) {
            if (queue.category !== "PvP") continue; // only render pvp queues
            if (queue.queueAvailability !== "Available") continue;
            if (this.isExcludedQueue(queue)) continue; // tutorials, Clash, ...
            if (seen[queue.id]) continue;

            // Mirror the official client: exactly four groups, keyed by map.
            // 11 = Summoner's Rift (Swiftplay/Draft/Ranked/...), 12 = ARAM
            // (+ Mayhem and other variants), 30 = Arena, 22 = Teamfight Tactics.
            // Any queue on other maps is hidden entirely.
            const key = "" + queue.mapId;
            if (SECTION_ORDER.indexOf(key) === -1) continue;
            seen[queue.id] = true;

            if (!ret[key]) ret[key] = [];
            ret[key].push(queue);
        }

        // Sort queues on whether they appear in the defaults list, and if yes where.
        // Queues known to the (legacy) enabled list get a slight priority as well.
        for (const queues of Object.values(ret)) {
            queues.sort((a, b) => {
                const aEnabled = this.enabledGameQueues.indexOf(a.id) !== -1 ? 0 : 1;
                const bEnabled = this.enabledGameQueues.indexOf(b.id) !== -1 ? 0 : 1;
                if (aEnabled !== bEnabled) return aEnabled - bEnabled;

                const aDefaultIndex = this.defaultGameQueues.indexOf(a.id);
                const bDefaultIndex = this.defaultGameQueues.indexOf(b.id);

                if (aDefaultIndex !== -1) {
                    if (bDefaultIndex !== -1) {
                        // Both are in the defaults, return the one that appears earlier.
                        return aDefaultIndex - bDefaultIndex;
                    }

                    // Only a appears in the defaults, so it should go first.
                    return -1;
                }

                // Only b appears in the deffaults, so it should go first.
                if (bDefaultIndex !== -1) {
                    return 1;
                }

                // Neither are in the defaults, we don't care about the order.
                return 0;
            });
        }

        return ret;
    }

    /**
     * Sections in the same order as the official client:
     * Summoner's Rift, ARAM, Arena, Teamfight Tactics.
     */
    get sections(): string[] {
        return Object.keys(this.availableQueues)
            .sort((a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b));
    }

    /**
     * @returns whether the queue should be hidden from the create-lobby list,
     * even if the platform reports it as available. Covers tutorials and
     * Clash (which cannot be created as a normal lobby).
     */
    isExcludedQueue(queue: GameQueue): boolean {
        // Any tutorial variant (TUTORIAL, TUTORIAL_MODULE_1, ...).
        if (queue.gameMode && queue.gameMode.toUpperCase().indexOf("TUTORIAL") !== -1) return true;
        if (queue.description && /tutorial/i.test(queue.description)) return true;

        // Clash and ARAM Clash: known queue ids plus a name-based safety net.
        if (queue.id === 700 || queue.id === 720) return true;
        if (queue.description && /clash/i.test(queue.description)) return true;

        return false;
    }

    /**
     * Selects the specified section, setting the current queue to
     * the first option within the specified section.
     */
    selectSection(section: string) {
        this.selectedSection = section;
        this.selectedQueueId = this.availableQueues[section][0].id;
    }

    /**
     * @returns the url to the map icon for the specified section
     */
    sectionIcon(section: string, extra: string) {
        const mapName = (<any>{
            "11": "sr",
            "12": "ha",
            "22": "tft",
            "30": "rgm"
        })[section] || "rgm";

        return this.iconPaths[mapName + "-" + extra];
    }

    /**
     * Creates a lobby with the currently chosen queue.
     */
    createLobby() {
        this.$root.request("/lol-lobby/v2/lobby", "POST", JSON.stringify({
            queueId: this.selectedQueueId
        }));
    }

    /**
     * @returns the gamemode name for the currently selected section
     */
    get sectionTitle() {
        return SECTION_TITLES[this.selectedSection] || "Rotating Game Mode";
    }
}

// The four official mode groups, in client order.
const SECTION_ORDER = ["11", "12", "30", "22"];

const SECTION_TITLES: { [key: string]: string } = {
    "11": "Summoner's Rift",
    "12": "ARAM",
    "30": "Arena",
    "22": "Teamfight Tactics"
};
