import Vue from "vue";
import Root from "../root/root";
import { Component, Prop } from "vue-property-decorator";
import Lobby, { InvitationMetadata, LobbyState } from "./lobby";

interface InvitationSuggestion {
    summonerId: number;
    summonerName: string;
}

interface Friend {
    summonerId: number;
    name: string;
    gameName: string;
    gameTag: string;
    availability: string; // chat | away | dnd | mobile | offline | ...
}

/**
 * Simple role picker. Pressing the X emits the 'selected' event with the same roles.
 */
@Component
export default class InviteOverlay extends Vue {
    $root: Root;

    @Prop()
    show: boolean;

    @Prop()
    state: LobbyState;

    inviteName: string = "";
    suggestions: InvitationSuggestion[] = [];
    friends: Friend[] = [];

    mounted() {
        this.$root.observe("/lol-suggested-players/v1/suggested-players", result => {
            this.suggestions = result.status === 200 ? result.content : [];
        });

        this.$root.observe("/lol-chat/v1/friends", result => {
            this.friends = result.status === 200 && Array.isArray(result.content) ? result.content : [];
        });
    }

    destroyed() {
        this.$root.unobserve("/lol-suggested-players/v1/suggested-players");
        this.$root.unobserve("/lol-chat/v1/friends");
    }

    /**
     * @returns friends that can be invited (online in League), sorted by availability
     */
    get invitableFriends(): Friend[] {
        const order: { [key: string]: number } = { chat: 0, away: 1, dnd: 2 };

        return this.friends
            .filter(x => x.summonerId && x.availability in order)
            .sort((a, b) => (order[a.availability] - order[b.availability]) || this.friendName(a).localeCompare(this.friendName(b)));
    }

    /**
     * @returns the display name of a friend (Riot ID when available)
     */
    friendName(friend: Friend): string {
        if (friend.gameName) return friend.gameName + (friend.gameTag ? " #" + friend.gameTag : "");
        return friend.name || "Unknown";
    }

    /**
     * @returns a css class representing the availability of a friend
     */
    friendStatusClass(friend: Friend): string {
        return "status-" + friend.availability;
    }

    /**
     * Invites the summoner with the specified id.
     */
    invite(toSummonerId: number) {
        this.$root.request("/lol-lobby/v2/lobby/invitations", "POST", JSON.stringify([{ toSummonerId }]));
    }

    /**
     * Searches for the summoner the user entered, inviting them if they exist.
     */
    async inviteManually() {
        const name = this.inviteName.trim();
        let result;

        if (name.indexOf("#") !== -1) {
            // Modern Riot ID (gameName#tagLine): resolve through the alias lookup endpoint.
            const [gameName, tagLine] = name.split("#");
            const aliases = await this.$root.request("/lol-summoner/v1/alias/lookup?gameName=" + encodeURIComponent(gameName.trim()) + "&tagLine=" + encodeURIComponent(tagLine.trim()));

            if (aliases.status === 200 && aliases.content) {
                const alias = Array.isArray(aliases.content) ? aliases.content[0] : aliases.content;
                if (alias && alias.puuid) {
                    result = await this.$root.request("/lol-summoner/v2/summoners/puuid/" + alias.puuid);
                }
            }
        } else {
            result = await this.$root.request("/lol-summoner/v1/summoners?name=" + encodeURIComponent(name));
        }

        if (!result || result.status !== 200 || !result.content || !result.content.summonerId) {
            alert("Summoner " + name + " was not found. Did you spell the name properly? Tip: use the full Riot ID, e.g. Name#TAG.");
            return;
        }

        this.invite(result.content.summonerId);
        this.inviteName = ""; // clear field
    }

    /**
     * Returns an icon name that shows the state of the specified invite.
     */
    getInvitationIcon(invite: InvitationMetadata): string {
        if (invite.state === "Declined") return "ion-close";
        if (invite.state === "Accepted") return "ion-checkmark";
        if (invite.state === "Kicked") return "ion-close"; // maybe find a better icon for this?
        return "ion-ios-more";
    }
}