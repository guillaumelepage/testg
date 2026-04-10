'use strict';
// Single source of truth for combat type chart and unit move types.
// Used by both server (constants.js) and client (js/game/data/units.js).

const TYPE_CHART = {
  LOURD:     { LOURD: 1,   LEGER: 1.5, CAVALERIE: 0.5, MAGIE: 0.5 },
  LEGER:     { LOURD: 0.7, LEGER: 1,   CAVALERIE: 1,   MAGIE: 1.2 },
  CAVALERIE: { LOURD: 1.5, LEGER: 1,   CAVALERIE: 1,   MAGIE: 0.7 },
  MAGIE:     { LOURD: 1.5, LEGER: 0.8, CAVALERIE: 1.2, MAGIE: 1   },
};

const UNIT_MOVE_TYPE = {
  // Player units
  chevalier:      'CAVALERIE',
  garde_roi:      'LOURD',
  homme_armes:    'LOURD',
  archer:         'LEGER',
  croise:         'LOURD',
  mercenaire:     'LEGER',
  compagnie_loup: 'LEGER',
  frere_epee:     'LOURD',
  paysan:         'LEGER',
  tyran:          'LOURD',
  banniere_rouge: 'CAVALERIE',
  // Heroes
  roi_guerrier:   'LOURD',
  chasseresse:    'LEGER',
  mage_arcane:    'MAGIE',
  paladin:        'LOURD',
  assassin:       'LEGER',
  necromancien:   'MAGIE',
  // Neutral mobs
  loup:           'LEGER',
  sanglier:       'CAVALERIE',
  ours:           'LOURD',
};

module.exports = { TYPE_CHART, UNIT_MOVE_TYPE };