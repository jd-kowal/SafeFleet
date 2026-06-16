const EventEmitter = require('events');

class RaftNode extends EventEmitter {
    constructor(id, peers, sendMessageCallback) {
        super();
        this.id = id;
        this.peers = peers;
        this.sendMessage = sendMessageCallback;
        
        this.state = 'FOLLOWER';
        this.currentTerm = 0;
        this.votedFor = null;
        this.votesReceived = 0;
        
        this.electionTimer = null;
        this.heartbeatTimer = null;
        this.blockchainTimer = null;
        this.rotationTimer = null;
        this.discoveryTimer = null; // Stoper wypatrywania
        
        this.currentLeaderId = null;
        this.fleetLocations = {};
        
        this.resetElectionTimeout();
    }

    // Parametr 'fast'. Jeśli true -> wybory odbywają się w ~1.5 sekundy.
    resetElectionTimeout(fast = false) {
        clearTimeout(this.electionTimer);
        const baseTime = fast ? 1000 : 120000;
        const randomTime = Math.floor(Math.random() * (fast ? 1000 : 5000));
        
        this.electionTimer = setTimeout(() => { 
            this.startElection(fast ? "Znaleziono towarzysza" : "Zbyt długi brak kontaktu od Lidera"); 
        }, baseTime + randomTime);
    }

    // Szukanie innych statków, gdy nie ma Lidera
    startDiscovery() {
        this.discoveryTimer = setInterval(() => {
            if (!this.currentLeaderId && this.state === 'FOLLOWER') {
                this.peers.forEach(peerId => {
                    this.sendMessage(peerId, { type: 'DISCOVERY', term: this.currentTerm, senderId: this.id });
                });
            }
        }, 3000);
    }

    startHeartbeat() {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            this.peers.forEach(peerId => {
                this.sendMessage(peerId, { type: 'HEARTBEAT', term: this.currentTerm, leaderId: this.id });
            });
        }, 30000); 
    }

    startElection(reason = "Wybory") {
        this.state = 'CANDIDATE';
        this.currentTerm += 1;
        this.votedFor = this.id;
        this.votesReceived = 1;
        this.currentLeaderId = null;

        console.log(`\n[Statek ${this.id}] ${reason}! Szybkie Wybory (Kadencja: ${this.currentTerm})`);
        this.resetElectionTimeout(false);

        this.peers.forEach(peerId => {
            this.sendMessage(peerId, { type: 'REQUEST_VOTE', term: this.currentTerm, candidateId: this.id });
        });
    }

    stepDown() {
        this.state = 'FOLLOWER';
        this.currentLeaderId = null; 
        clearInterval(this.heartbeatTimer);
        clearInterval(this.blockchainTimer);
        clearTimeout(this.rotationTimer);
    }

    handleMessage(msg) {
        if (msg.term > this.currentTerm) {
            this.currentTerm = msg.term;
            this.stepDown();
            this.votedFor = null;
        }

        switch (msg.type) {
            case 'HEARTBEAT':
                if (msg.term >= this.currentTerm) {
                    if (this.state !== 'FOLLOWER') console.log(`[Statek ${this.id}] Uznaję nowego lidera: ${msg.leaderId}`);
                    this.state = 'FOLLOWER';
                    this.currentLeaderId = msg.leaderId;
                    this.resetElectionTimeout(false); // Powrot do standardowego 2-minutowego odliczania
                }
                break;
                
            case 'REQUEST_VOTE':
                if (msg.term >= this.currentTerm && (this.votedFor === null || this.votedFor === msg.candidateId)) {
                    this.votedFor = msg.candidateId;
                    this.resetElectionTimeout(false);
                    this.sendMessage(msg.candidateId, { type: 'VOTE_GRANTED', term: this.currentTerm });
                }
                break;
                
            case 'VOTE_GRANTED':
                if (this.state === 'CANDIDATE' && msg.term === this.currentTerm) {
                    this.votesReceived += 1;
                    const quorum = Math.floor((this.peers.length + 1) / 2) + 1;
                    if (this.votesReceived >= quorum) this.becomeLeader();
                }
                break;
                
            case 'GPS_REPORT':
                if (this.state === 'LEADER') this.fleetLocations[msg.senderId] = msg.data;
                break;

            case 'LEADER_RESIGNED':
                if (msg.term >= this.currentTerm) {
                    console.log(`[Statek ${this.id}] Dotychczasowy lider zrezygnował.`);
                    this.stepDown();
                    this.resetElectionTimeout(true); // Wymusza szybkie wybory (1 sekunda)
                }
                break;
                
            // Reakcja na pingowanie innych statków przy starcie
            case 'DISCOVERY':
                if (this.currentLeaderId && this.state === 'LEADER') {
                    // Jestem liderem, ktoś nowy się obudził -> od razu wysyłam mu mój heartbeat, żeby go uspokoić.
                    this.sendMessage(msg.senderId, { type: 'HEARTBEAT', term: this.currentTerm, leaderId: this.id });
                } else if (!this.currentLeaderId && this.state === 'FOLLOWER') {
                    // Nikogo nie ma za sterami, a usłyszałem kolegę -> robimy szybkie wybory!
                    this.resetElectionTimeout(true);
                }
                break;
        }
    }

    becomeLeader() {
        this.state = 'LEADER';
        this.currentLeaderId = this.id;
        console.log(`\n[Statek ${this.id}] Zostałem nowym Liderem Floty!`);
        
        clearTimeout(this.electionTimer);
        this.startHeartbeat(); 
        
        this.blockchainTimer = setInterval(() => {
            this.emit('submitToBlockchain', this.fleetLocations);
        }, 60000);

        this.rotationTimer = setTimeout(() => {
            console.log(`\n[Statek ${this.id}] Moja kadencja (4 minuty) dobiegła końca. Wymuszam zmianę warty!`);
            this.stepDown();
            this.peers.forEach(peerId => {
                this.sendMessage(peerId, { type: 'LEADER_RESIGNED', term: this.currentTerm });
            });
            this.resetElectionTimeout(true); // Ja też startuję w wyborach
        }, 240000);
    }
}

module.exports = RaftNode;
