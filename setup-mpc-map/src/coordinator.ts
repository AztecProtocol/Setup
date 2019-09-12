import moment, { Moment } from 'moment';
import { applyDelta, MpcServer, MpcState, Participant, ParticipantLocation } from 'setup-mpc-common';
import { LatLon, Viewer } from './viewer';

const formatMoment = (m: Moment) => m.format('YYYY-MM-DD HH:mm:ss.SS');

export class Coordinator {
  private timer?: NodeJS.Timer;
  private state!: MpcState;
  private running?: Participant;

  constructor(private viewer: Viewer, private server: MpcServer) {
    viewer.on('tick', time => this.onTick(time));
  }

  public start() {
    this.updateState();
  }

  public stop() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.viewer.removeAllListeners();
  }

  private onTick(currentTime: Date) {
    document.getElementById('overlay-time')!.innerHTML = formatMoment(moment(currentTime));
  }

  private async updateState() {
    try {
      // Then get the latest state from the server.
      const remoteStateDelta = await this.server.getState(this.state ? this.state.sequence : undefined);

      let state: MpcState;
      if (!this.state) {
        state = remoteStateDelta;
      } else if (this.state.startSequence !== remoteStateDelta.startSequence) {
        state = await this.server.getState();
      } else {
        state = applyDelta(this.state, remoteStateDelta);
      }

      await this.processState(state);
    } finally {
      setTimeout(() => this.updateState(), 1000);
    }
  }

  private getLocationString(location: ParticipantLocation) {
    return [location.city, location.country, location.continent]
      .filter(x => x)
      .slice(0, 2)
      .join(', ');
  }

  private setAddress(p: Participant) {
    const addrString = p.address.toString();
    const progIndex = addrString.length * (p.computeProgress / 100);
    document.getElementById('overlay-address-done')!.innerHTML = addrString.slice(0, progIndex);
    document.getElementById('overlay-address-not-done')!.innerHTML = addrString.slice(progIndex);
    document.getElementById('overlay-address-done')!.className = 'yellow';
    document.getElementById('overlay-address-not-done')!.className = 'grey';

    switch (p.state) {
      case 'COMPLETE':
        document.getElementById('overlay-address-done')!.className = 'green';
        break;
      case 'INVALIDATED':
        document.getElementById('overlay-address-done')!.className = 'red';
        document.getElementById('overlay-address-not-done')!.className = 'red';
    }
  }

  private setProgress(p: Participant) {
    if (p.runningState === 'OFFLINE') {
      document.getElementById('overlay-progress-online-only')!.style.display = 'none';
    } else {
      document.getElementById('overlay-progress-online-only')!.style.display = 'inline';
    }

    if (p.state === 'COMPLETE') {
      document.getElementById('overlay-progress-download')!.innerHTML = '100%';
      document.getElementById('overlay-progress-upload')!.innerHTML = '100%';
      document.getElementById('overlay-progress-compute')!.innerHTML = '100%';
      document.getElementById('overlay-progress-verify')!.innerHTML = '100%';
    } else if (p.state === 'RUNNING') {
      const totalData = p.transcripts.reduce((a, t) => a + t.size, 0);
      const totalDownloaded = p.transcripts.reduce((a, t) => a + t.downloaded, 0);
      const totalUploaded = p.transcripts.reduce((a, t) => a + t.uploaded, 0);
      const downloadProgress = totalData ? (totalDownloaded / totalData) * 100 : 0;
      const uploadProgress = totalData ? (totalUploaded / totalData) * 100 : 0;
      document.getElementById('overlay-progress-download')!.innerHTML = `${downloadProgress.toFixed(2)}%`;
      document.getElementById('overlay-progress-upload')!.innerHTML = `${uploadProgress.toFixed(2)}%`;
      document.getElementById('overlay-progress-compute')!.innerHTML = `${p.computeProgress.toFixed(2)}%`;
      document.getElementById('overlay-progress-verify')!.innerHTML = `${p.verifyProgress.toFixed(2)}%`;
    }
  }

  private updateParticipantOverlay(p: Participant, state: MpcState) {
    document.getElementById('participant-overlay')!.style.display = 'block';
    document.getElementById('overlay-location')!.innerHTML = p.location
      ? this.getLocationString(p.location)
      : 'Unknown';

    this.setAddress(p);

    if (p.online) {
      document.getElementById('overlay-status')!.innerHTML =
        p.runningState === 'OFFLINE' ? 'COMPUTING OFFLINE' : 'ONLINE';
      document.getElementById('overlay-status')!.className = 'green';
    } else {
      document.getElementById('overlay-status')!.innerHTML = 'OFFLINE';
      document.getElementById('overlay-status')!.className = 'red';
    }

    this.setProgress(p);

    const { invalidateAfter, numG1Points, numG2Points, pointsPerTranscript } = state!;
    const verifyWithin = invalidateAfter / (Math.max(numG1Points, numG2Points) / pointsPerTranscript);
    const verifyTimeout = Math.max(
      0,
      moment(p.lastVerified || p.startedAt!)
        .add(verifyWithin, 's')
        .diff(moment(), 's')
    );

    const totalSkip = Math.max(
      0,
      moment(p.startedAt!)
        .add(invalidateAfter, 's')
        .diff(moment(), 's')
    );

    document.getElementById('overlay-progress-skip')!.innerHTML =
      p.tier > 1 ? `${verifyTimeout}/${totalSkip}s` : `${totalSkip}s`;
  }

  private updateCeremonyStatus(state: MpcState) {
    const el = document.getElementById('overlay-ceremony-status')!;
    switch (state.ceremonyState) {
      case 'PRESELECTION':
        el.className = 'yellow';
        el.innerHTML = `SELECTING IN ${state.selectBlock - state.latestBlock} BLOCKS`;
        break;
      case 'SELECTED':
        el.className = 'green';
        el.innerHTML = `PARTICIPANTS SELECTED`;
        break;
      case 'RUNNING':
        if (!state.participants.some(p => p.state === 'RUNNING')) {
          el.className = 'yellow';
          el.innerHTML = `AWAITING PARTICIPANT`;
        } else {
          el.className = 'green';
          el.innerHTML = `RUNNING`;
        }
        break;
      case 'SEALING':
        el.className = 'yellow';
        el.innerHTML = `SEALING (${state.sealingProgress.toFixed(2)}%)`;
        break;
      case 'PUBLISHING':
        el.className = 'yellow';
        el.innerHTML = `PUBLISHING (${state.publishProgress.toFixed(2)}%)`;
        break;
      case 'COMPLETE':
        el.className = 'green';
        el.innerHTML = 'COMPLETE';
        break;
    }
  }

  private updateStatusOverlay(state: MpcState) {
    document.getElementById('overlay-participants')!.innerHTML = `${state.participants.length}`;
    const online = state.participants.reduce((a, p) => (p.online ? a + 1 : a), 0);
    const offline = state.participants.reduce((a, p) => (!p.online ? a + 1 : a), 0);
    const complete = state.participants.reduce((a, p) => (p.state === 'COMPLETE' ? a + 1 : a), 0);
    const invalidated = state.participants.reduce((a, p) => (p.state === 'INVALIDATED' ? a + 1 : a), 0);
    const startIn = Math.max(0, moment(state.startTime).diff(moment(), 's'));
    document.getElementById('overlay-online')!.innerHTML = `${online}`;
    document.getElementById('overlay-offline')!.innerHTML = `${offline}`;
    document.getElementById('overlay-complete')!.innerHTML = `${complete}`;
    document.getElementById('overlay-invalidated')!.innerHTML = `${invalidated}`;

    this.updateCeremonyStatus(state);

    if (state.ceremonyState === 'PRESELECTION' || state.ceremonyState === 'SELECTED') {
      document.getElementById('status-overlay-starting-in')!.style.display = 'block';
      document.getElementById('status-overlay-started-at')!.style.display = 'none';
      document.getElementById('overlay-starting-in')!.innerHTML = `T-${startIn}s`;
    } else {
      document.getElementById('status-overlay-started-at')!.style.display = 'block';
      document.getElementById('status-overlay-starting-in')!.style.display = 'none';
      document.getElementById('overlay-started-at')!.innerHTML = formatMoment(state.startTime);
    }

    if (state.completedAt) {
      document.getElementById('status-overlay-time')!.style.display = 'none';
      document.getElementById('status-overlay-completed-at')!.style.display = 'block';
      document.getElementById('overlay-completed-at')!.innerHTML = formatMoment(state.completedAt!);
    } else {
      document.getElementById('status-overlay-time')!.style.display = 'block';
      document.getElementById('status-overlay-completed-at')!.style.display = 'none';
    }
  }

  private updateQueueOverlay(state: MpcState) {
    const focusIndex = state.participants.findIndex(p => p.state === 'RUNNING' || p.state === 'WAITING');
    const startIndex = Math.min(Math.max(0, focusIndex - 2), state.participants.length - 5);
    const queue = state.participants.slice(startIndex, startIndex + 5);
    queue.forEach((p, i) => {
      document.getElementById(`queue-overlay-online${i + 1}`)!.className = p.online ? 'green' : 'red';
      document.getElementById(`queue-overlay-position${i + 1}`)!.innerHTML = `${p.position
        .toString()
        .padStart(2, '0')}.`;
      const addrElement = document.getElementById(`queue-overlay-address${i + 1}`)!;
      const metaElement = document.getElementById(`queue-overlay-meta${i + 1}`)!;
      addrElement.innerHTML = p.address.toString();
      switch (p.state) {
        case 'COMPLETE':
          addrElement.className = 'green';
          metaElement.innerHTML = `(${p.completedAt!.diff(p.startedAt, 's')}s)`;
          break;
        case 'INVALIDATED':
          addrElement.className = 'red';
          break;
        default:
          addrElement.className = 'grey';
          if (state.ceremonyState !== 'PRESELECTION') {
            metaElement.innerHTML = `(${p.priority})`;
          } else {
            metaElement.innerHTML = '';
          }
      }
    });
    document.getElementById('queue-overlay')!.style.display = 'block';
  }

  private updateIgnitionCountdown(state: MpcState) {
    const startIn = Math.max(0, moment(state.startTime).diff(moment(), 's'));
    if (state.startTime.isAfter() && startIn <= 60) {
      document.getElementById('ignition-countdown')!.style.display = 'block';
      const ignitionEl = document.getElementById('ignition-countdown')!;
      const newIgnitionEl = ignitionEl.cloneNode() as HTMLElement;
      newIgnitionEl.innerHTML = `${startIn}`;
      ignitionEl.replaceWith(newIgnitionEl);
    } else {
      document.getElementById('ignition-countdown')!.style.display = 'none';
    }
  }

  private async processState(state: MpcState) {
    if (!this.state || this.state.startSequence !== state.startSequence) {
      // First time processing state. Update completed markers and go to standby.
      this.running = undefined;
      this.viewer.updateCompletedEntities(this.getCompletedLocations(state));
      await this.viewer.standby();
    }

    document.getElementById('overlay-container')!.style.display = 'block';

    this.updateStatusOverlay(state);

    if (this.running) {
      this.running = state.participants.find(p => this.running!.address.equals(p.address));
    }

    const running = state.participants.find(p => p.state === 'RUNNING');

    if (this.running && (!running || !running.address.equals(this.running.address))) {
      // We are shifting to standby, or a new participant. First wait a few seconds so we can see why.
      this.updateParticipantOverlay(this.running, state);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (running) {
      this.updateParticipantOverlay(running, state);
      document.getElementById('queue-overlay')!.style.display = 'none';
    } else {
      this.updateQueueOverlay(state);
      document.getElementById('participant-overlay')!.style.display = 'none';
    }

    if (running && (!this.running || !this.running.address.equals(running.address))) {
      // We are shifting from standby, or to a new participant.
      if (running.location) {
        this.running = running;
        await this.viewer.focus(running.location.latitude!, running.location.longitude!);
      } else if (this.running) {
        this.running = running;
        await this.viewer.standby();
      }
    } else if (!running && this.running) {
      // We are shifting to standby.
      this.viewer.updateCompletedEntities(this.getCompletedLocations(state));
      await this.viewer.standby();
      this.running = undefined;
    }

    this.updateIgnitionCountdown(state);

    this.state = state;
  }

  private getCompletedLocations(state: MpcState): LatLon[] {
    return state.participants
      .filter(p => p.state === 'COMPLETE' && p.location)
      .map(p => ({ lat: p.location!.latitude!, lon: p.location!.longitude! }));
  }
}
