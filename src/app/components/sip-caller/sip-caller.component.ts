import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {SipSettings} from "../../models/sip-settings.model";
import * as JsSIP from 'jssip';
import {CallOptions, UAConfiguration, UAEventMap} from "jssip/lib/UA";
import {RTCSession, RTCSessionEventMap} from "jssip/lib/RTCSession";

@Component({
    selector: 'app-sip-caller',
    templateUrl: './sip-caller.component.html',
    styleUrls: ['./sip-caller.component.scss']
})
export class SipCallerComponent implements OnInit {
    constructor() {
        this.sipSettings = this.getSipSettings();
    }

    public isShowIncomingCall: boolean = false;
    public isShowOutgoingCall: boolean = false;

    public sipSettings: SipSettings;
    public sipStatus?: string;
    public sipCallStatus?: string;

    @ViewChild('sound') sound?: ElementRef<HTMLAudioElement>;
    @ViewChild('localAudio') localAudio?: ElementRef<HTMLAudioElement>;
    @ViewChild('remoteAudio') remoteAudio?: ElementRef<HTMLAudioElement>;

    private ua?: JsSIP.UA;
    private rtcSession?: RTCSession;

    private callEvents = <RTCSessionEventMap>{
         connecting: (e: any) => {
            console.log('connecting');
        },
        sending: (e: any) => {
            console.log('sending');
        },
        progress: (e: any) => {
            if (this.rtcSession?.connection) {
                this.rtcSession.connection.ontrack = (rtcTrackEvent) => {
                    if (this.remoteAudio) {
                        this.remoteAudio.nativeElement.srcObject = rtcTrackEvent.streams[0];
                    }
                };
            }
        },
        accepted: (e: any) => {
            console.log('accepted');
        },
        confirmed: (e: any) => {
            console.log('confirmed');
            this.playSound(SoundsName.answered, false);
        },
        peerconnection: (e: any) => {
            if (!this.rtcSession?.connection) {
                return;
            }

            this.rtcSession.connection.addEventListener('addstream', (e: any) => {
                if (!this.remoteAudio) {
                    return;
                }

                this.remoteAudio.nativeElement.srcObject = (e.stream);
            });
        },
        ended: (e: any) => {
            console.log('ended: ', e.cause);
            this.playSound(SoundsName.rejected, false);
            this.hangUp();
        },
        failed: (e: any) => {
            console.log('failed: ', e.cause);
            this.stopSound();
            this.hangUp();
        },
        newDTMF: (e: any) => {
            console.log('newDTMF');
        },
        newInfo: (e: any) => {
            console.log('newInfo');
        },
        hold: (e: any) => {
            console.log('hold');
        },
        unhold: (e: any) => {
            console.log('unhold');
        },
        muted: (e: any) => {
            console.log('muted');
        },
        unmuted: (e: any) => {
            console.log('unmuted');
        },
        reinvite: (e: any) => {
            console.log('reinvite');
        },
        update: (e: any) => {
            console.log('update');
        },
        refer: (e: any) => {
            console.log('refer');
        },
        replaces: (e: any) => {
            console.log('replaces');
        },
        sdp: (e: any) => {
            console.log('sdp');
        },
        icecandidate: (e: any) => {
            console.log('icecandidate');
        },
        getusermediafailed: (e: any) => {
            console.log('getusermediafailed');
        },

        'peerconnection:createofferfailed': (e: any) => {
            console.log('peerconnection:createofferfailed');
        },
        'peerconnection:createanswerfailed': (e: any) => {
            console.log('peerconnection:createanswerfailed');
        },
        'peerconnection:setlocaldescriptionfailed': (e: any) => {
            console.log('peerconnection:setlocaldescriptionfailed');
        },
        'peerconnection:setremotedescriptionfailed': (e: any) => {
            console.log('peerconnection:setremotedescriptionfailed');
        },
    };
    private uaEvents = <UAEventMap>{
        connecting: (e) => {
            this.sipStatus = ('connecting')
        },
        connected: (e) => {
            this.sipStatus = ('connected')
        },
        disconnected: (e) => {
            this.sipStatus = ('disconnected')
        },
        registrationFailed: (e) => {
            this.sipStatus = ('registrationFailed')
        },
        unregistered: (e) => {
            this.sipStatus = ('unregistered')
        },
        registered: (e) => {
            this.sipStatus = ('registered')
        },
        newRTCSession: (e: any) => {
            this.rtcSession = e.session;
            if (e?.session.direction === 'incoming') {
                this.playSound(SoundsName.ringing, true);
                this.isShowIncomingCall = true;
                this.addEvents(this.rtcSession, this.callOptions?.eventHandlers);
            }
        },
        newMessage: (e: any) => console.log('newMessage')
    };
    private callOptions: CallOptions = {
        eventHandlers: this.callEvents,
        mediaConstraints: {audio: true, video: false},
    };

    //region OutgoingPhoneNumber
    get outgoingPhoneNumber() {
        return localStorage.getItem(StorageKey.outgoingPhoneNumber) ?? "";
    }

    set outgoingPhoneNumber(value) {
        localStorage.setItem(StorageKey.outgoingPhoneNumber, value);
    }

    //endregion

    ngOnInit(): void {
        JsSIP.debug.enable('JsSIP:*');
    }

    ngOnDestroy() {
        this.hangUp();
    }

    public connection() {
        const socket = new JsSIP.WebSocketInterface(this.sipSettings.wssDomain);

        const configuration: UAConfiguration = {
            sockets: [socket],
            uri: this.sipSettings.identity,
            password: this.sipSettings.password
        };

        this.ua = new JsSIP.UA(configuration);
        this.addEvents(this.ua, this.uaEvents);
        this.ua.start();
    }

    public outgoingCall() {
        if (this.rtcSession && this.rtcSession.isInProgress()) {
            this.rtcSession.terminate();
        }

        if (!this.ua) {
            this.connection();
            this.outgoingCall();
            return;
        }

        this.isShowOutgoingCall = true;
        this.playSound(SoundsName.ringback, true);
        this.rtcSession = this.ua.call(this.outgoingPhoneNumber, this.callOptions);
    }

    public hangUp() {
        if (this.isShowIncomingCall) {
            this.isShowIncomingCall = false;
        }

        if (this.isShowOutgoingCall) {
            this.isShowOutgoingCall = false;
        }

        if (this.rtcSession) {
            try {
                this.rtcSession.terminate();
            } catch {
            }
        }
    }

    public acceptIncomingCall() {
        if (this.rtcSession) {
            this.rtcSession.answer();
        }
        this.stopSound();
    }

    //#region Get/Save Sip Settings
    public saveSipSettings() {
        localStorage.setItem(StorageKey.sipSettings, JSON.stringify(this.sipSettings));
    }

    public getSipSettings(): SipSettings {
        const sipSettings = localStorage.getItem(StorageKey.sipSettings);

        if (sipSettings) {
            return JSON.parse(sipSettings)
        }

        return new SipSettings("", "", "");
    }

    //#endregion

    //#region Sound Play/Stop
    private playSound(soundName: string, loop: boolean) {
        if (!this.sound) {
            return;
        }

        this.sound.nativeElement.pause();
        this.sound.nativeElement.currentTime = 0.0;
        this.sound.nativeElement.src = `/assets/sounds/${soundName}`;
        this.sound.nativeElement.loop = loop;
        this.sound.nativeElement.play();
    }

    private stopSound() {
        if (!this.sound) {
            return;
        }

        this.sound.nativeElement.pause();
        this.sound.nativeElement.currentTime = 0.0;
    }

    //#endregion

    private addEvents(source: any, events: any) {
        if (!source || !events) {
            return;
        }

        Object.getOwnPropertyNames(events).forEach(eventName => {
            source.on(eventName, events[eventName]);
        });
    }
}

export enum SoundsName {
    ringing = 'ringing.ogg',
    rejected = 'rejected.mp3',
    ringback = 'ringback.ogg',
    answered = 'answered.mp3'
}

export enum StorageKey {
    sipSettings = 'sipSettings',
    outgoingPhoneNumber = 'outgoingPhoneNumber'
}
