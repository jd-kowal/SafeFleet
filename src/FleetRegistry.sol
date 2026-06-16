// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract FleetRegistry {
    address public admin;
    mapping(address => bool) public authorizedShips;

    // Przechowujemy złączone dane w formie stringa (JSON)
    string public latestFleetData;
    uint256 public latestTerm;
    address public currentLeader;

    event DataUpdated(address indexed leader, uint256 term, string data);

    constructor() {
        admin = msg.sender;
    }

    // Dodawanie statku do whitelist
    function authorizeShip(address _ship) external {
        require(msg.sender == admin, "Tylko admin");
        authorizedShips[_ship] = true;
    }

    // Raportowanie danych przez Lidera
    function updateFleetData(uint256 _term, string calldata _fleetDataJson) external {
        require(authorizedShips[msg.sender], "Statek nieautoryzowany");
        require(_term >= latestTerm, "Kadencja przestarzala");

        latestTerm = _term;
        currentLeader = msg.sender;
        latestFleetData = _fleetDataJson;

        emit DataUpdated(msg.sender, _term, _fleetDataJson);
    }
}
