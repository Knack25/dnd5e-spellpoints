var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
  return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
      function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
      function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};

const MODULE_NAME = 'dnd5e-spellpoints-custom';

Handlebars.registerHelper("spFormat", (path, ...args) => {
return game.i18n.format(path, args[0].hash);
});

class SpellPoints {
static get settings() {
  return mergeObject(this.defaultSettings, game.settings.get(MODULE_NAME, 'settings'));
}

/**
 * Get default settings object.
 */
static get defaultSettings() {
  return {
    spEnableSpellpoints: false,
    spResource: 'Spell Points',
    spAutoSpellpoints: false,
    spFormula: 'DMG',
    warlockUseSp: false,
    chatMessagePrivate : false,
    spellPointsByLevel: {1:4,2:6,3:14,4:17,5:27,6:32,7:38,8:44,9:57,10:64,11:73,12:73,13:83,14:83,15:94,16:94,17:107,18:114,19:123,20:133},
    spellPointsCosts: {1:2,2:3,3:5,4:6,5:7,6:9,7:10,8:11,9:13},
    spEnableVariant: false,
    spLifeCost: 2,
    spMixedMode: false,
    isCustom: "false",
    spCustomFormulaBase: '0',
    spCustomFormulaSlotMultiplier: '1'
  };
}

/**
 * Get a map of formulas to override values specific to those formulas.
 */
static get formulas() {
  return {
    DMG: {
      isCustom: "false",
      spellPointsByLevel: {1:4,2:6,3:14,4:17,5:27,6:32,7:38,8:44,9:57,10:64,11:73,12:73,13:83,14:83,15:94,16:94,17:107,18:114,19:123,20:133},
      spellPointsCosts: {1:'2',2:'3',3:'5',4:'6',5:'7',6:'9',7:'10',8:'11',9:'13'}
    },
    CUSTOM: {
      isCustom: "true"
    },
    DMG_CUSTOM: {
      isCustom: "true",
      spCustomFormulaBase: '0',
      spCustomFormulaSlotMultiplier: '1',
      spellPointsCosts: {1:'2',2:'3',3:'5',4:'6',5:'7',6:'9',7:'10',8:'11',9:'13'}
    },
    AM_CUSTOM: {
      isCustom: "true",
      spCustomFormulaBase: 'ceil((1*@spells.spell1.max + 2*@spells.spell2.max + 3*@spells.spell3.max + 4*@spells.spell4.max + 5*@spells.spell5.max + 6*@spells.spell6.max + 7*@spells.spell7.max + 8*@spells.spell8.max + 9*@spells.spell9.max) / 2) + @attributes.spelldc - 8 - @attributes.prof',
      spCustomFormulaSlotMultiplier: '0',
      spellPointsCosts: {1:'1',2:'2',3:'3',4:'4',5:'5',6:'12',7:'14',8:'24',9:'27'}
    }
  }
}

static isModuleActive(){
  return game.settings.get(MODULE_NAME, 'spEnableSpellpoints');
}

static isModuleActive(){
  return game.settings.get(MODULE_NAME, 'spEnableSpellpoints');
}

static isActorCharacter(actor){
  return getProperty(actor, "type") == "character";
}

static isMixedActorSpellPointEnabled(actor){
  if (actor.flags !== undefined) {
    if (actor.flags.dnd5espellpoints !== undefined) {
      if (actor.flags.dnd5espellpoints.enabled !== undefined ){
        return actor.flags.dnd5espellpoints.enabled
      }
    }
  }
  return false;
}

/**
 * Evaluates the given formula with the given actors data. Uses FoundryVTT's Roll
 * to make this evaluation.
 * @param {string|number} formula The rollable formula to evaluate.
 * @param {object} actor The actor used for variables.
 * @return {number} The result of the formula.
 */
static withActorData(formula, actor) {
  let dataObject = actor.getRollData();
  dataObject.flags = actor.flags;
  const r = new Roll(formula.toString(), dataObject);
  r.evaluate({async: false});
  return r.total;
}

/** check what resource is spellpoints on this actor **/
// static getSpellPointsResource {
//     return window.pr.api.get('points_mana');
// }

static castSpell(actor, update) {
  /** do nothing if module is not active **/
  if (!SpellPoints.isModuleActive() || !SpellPoints.isActorCharacter(actor))
    return update;
  
  /* if mixedMode active Check if SpellPoints is enabled for this actor */
  if (this.settings.spMixedMode && !SpellPoints.isMixedActorSpellPointEnabled(actor))
    return update;
  
  /** check if this is a spell casting **/
  let spell = getProperty(update, "system.spells");
  
  if (!spell || spell === undefined)
    return update;

  let hp = getProperty(update, "system.attributes.hp.value");
  let spellPointResource = window.pr.api.get('points_mana');

  /** not found any resource for spellpoints ? **/
  if (!spellPointResource) {
    ChatMessage.create({
      content: "<i style='color:red;'>" + game.i18n.format("dnd5e-spellpoints.actorNoSP", {ActorName: actor.name, SpellPoints: this.settings.spResource }) + "</i>",
      speaker: ChatMessage.getSpeaker({ alias: actor.name })
    });
    game.i18n.format("dnd5e-spellpoints.createNewResource", this.settings.spResource);
    ui.notifications.error(game.i18n.format("dnd5e-spellpoints.createNewResource", { SpellPoints : this.settings.spResource }));
    return {};
  }

  /** check if is pact magic **/
  let isPact = false;
  if (getProperty(update, "system.spells.pact") !== undefined) {
    isPact = true;
  }
  
   /** find the spell level just cast */
  const spellLvlNames = ["spell1", "spell2", "spell3", "spell4", "spell5", "spell6", "spell7", "spell8", "spell9", "pact"];
  let spellLvlIndex = spellLvlNames.findIndex(name => { return getProperty(update, "system.spells." + name) });
  let spellLvl = spellLvlIndex + 1;
  
  if (isPact) {
    // Pact magic
    if (this.settings.warlockUseSp) {
      spellLvl = actor.system.spells.pact.level;
    } else {
      return update;
    }
  }
  
  //** slot calculation **/
  const origSlots = actor.system.spells;
  const preCastSlotCount = getProperty(origSlots, spellLvlNames[spellLvlIndex] + ".value");
  const postCastSlotCount = getProperty(update, "system.spells." + spellLvlNames[spellLvlIndex] + ".value");
  let maxSlots = getProperty(origSlots, spellLvlNames[spellLvlIndex] + ".max");

  let slotCost = preCastSlotCount - postCastSlotCount;

  /** restore slots to the max **/
  if (typeof maxSlots === undefined) {
    maxSlots = 1;
    update.system.spells[spellLvlNames[spellLvlIndex]].max = maxSlots;
  }
  update.system.spells[spellLvlNames[spellLvlIndex]].value = maxSlots;

  const maxSpellPoints = window.pr.api.get('points_mana_max');
  const actualSpellPoints = window.pr.api.get('points_mana');

  /* get spell cost in spellpoints */
  const spellPointCost = this.withActorData(this.settings.spellPointsCosts[spellLvl], actor);
  
  /** check if message should be visible to all or just player+gm */
  let SpeakTo = [];
  if (this.settings.chatMessagePrivate){
    SpeakTo = game.users.filter(u => u.isGM);
  }

  /** update spellpoints **/
  if (actualSpellPoints - spellPointCost >= 0 ) {
    /* character has enough spellpoints */
    spellPointResource = spellPointResource - spellPointCost;

    ChatMessage.create({
      content: "<i style='color:green;'>"+game.i18n.format("dnd5e-spellpoints.spellUsingSpellPoints",
        {
        ActorName : actor.name,
        SpellPoints: this.settings.spResource,
        spellPointUsed: spellPointCost,
        remainingPoints: spellPointResource
        })+"</i>",
      speaker: ChatMessage.getSpeaker({ alias: actor.name }),
      isContentVisible : false,
      isAuthor :true,
      whisper : SpeakTo
    });
  } else if (actualSpellPoints - spellPointCost < 0) {
    /** check if actor can cast using HP **/
    if (this.settings.spEnableVariant) {
      // spell point resource is 0 but character can still cast.
      spellPointResource = 0;
      const hpMaxLost = spellPointCost * SpellPoints.withActorData(SpellPoints.settings.spLifeCost, actor);
      const hpActual = actor.system.attributes.hp.value;
      let hpTempMaxActual = actor.system.attributes.hp.tempmax;
      const hpMaxFull = actor.system.attributes.hp.max;
      if (!hpTempMaxActual)
        hpTempMaxActual = 0;
      const newTempMaxHP = hpTempMaxActual - hpMaxLost;
      const newMaxHP = hpMaxFull + newTempMaxHP;

      if (hpMaxFull + newTempMaxHP <= 0) { //character is permanently dead
        // 3 death saves failed and 0 hp
        update.system.attributes = {'death':{'failure':3}, 'hp':{'tempmax':-hpMaxFull,'value':0}};
        ChatMessage.create({
          content: "<i style='color:red;'>"+game.i18n.format("dnd5e-spellpoints.castedLifeDead", { ActorName : actor.name })+"</i>",
          speaker: ChatMessage.getSpeaker({ alias: actor.name }),
          isContentVisible : false,
          isAuthor :true,
          whisper : SpeakTo
        });
      } else {
        update.system.attributes = {'hp':{'tempmax':newTempMaxHP}};// hp max reduction
        if (hpActual > newMaxHP) { // a character cannot have more hp than his maximum
          update.system.attributes = mergeObject(update.system.attributes,{'hp':{'value': newMaxHP}});
        }
        ChatMessage.create({
          content: "<i style='color:red;'>"+game.i18n.format("dnd5e-spellpoints.castedLife", { ActorName : actor.name, hpMaxLost: hpMaxLost })+"</i>",
          speaker: ChatMessage.getSpeaker({ alias: actor.name }),
          isContentVisible : false,
          isAuthor :true,
          whisper : SpeakTo
        });
      }
    } else {
      ChatMessage.create({
        content: "<i style='color:red;'>"+game.i18n.format("dnd5e-spellpoints.notEnoughSp", { ActorName : actor.name, SpellPoints: this.settings.spResource })+"</i>",
        speaker: ChatMessage.getSpeaker({ alias: actor.name }),
        isContentVisible : false,
        isAuthor :true,
        whisper : SpeakTo
      });
    }
  }
  if (typeof update.system.resources === 'undefined'){
    update.system.resources = {};
  }
  //update.system.resources[spellPointResource.key] = { 'value' : spellPointResource.values.value };
  window.pr.api.set('points_mana',spellPointResource);
  return update;
}

static checkDialogSpellPoints(dialog, html, formData){
  if (!SpellPoints.isModuleActive())
    return;
  
  /** check if actor is a player character **/
  let actor = getProperty(dialog, "item.actor");
  if(!this.isActorCharacter(actor))
    return;
  
  /* if mixedMode active Check if SpellPoints is enabled for this actor */
  if (this.settings.spMixedMode && !SpellPoints.isMixedActorSpellPointEnabled(actor))
    return;
  
  
  /** check if this is a spell **/
  if ( getProperty(dialog, "item.type") !== "spell" )
    return;
  
  const spell = dialog.item.system;

  const preparation = spell.preparation; //prepared,pact,always,atwill,innate
  // spell level can change later if casting it with a greater slot, baseSpellLvl is the default
  const baseSpellLvl = spell.level;
    

  /** get spellpoints **/
  let spellPointResource = window.pr.api.get('points_mana');
  if (!spellPointResource) {
    // this actor has no spell point resource what to do?
    const messageCreate = game.i18n.format("dnd5e-spellpoints.pleaseCreate", {SpellPoints: this.settings.spResource });
    $('#ability-use-form', html).append('<div class="spError">'+messageCreate+'</div>');
    return;
  }

  // Declare settings as a separate variable because jQuery overrides `this` when in an each() block
  let settings = this.settings;
  
  let level = 'none';
  
  /** Replace list of spell slots with list of point costs **/
  $('select[name="level"] option', html).each(function() {
    let selectValue =  $(this).val();
    
    if (selectValue == 'pact') {
      if (settings.warlockUseSp) {
        level = actor.system.spells.pact.level;
      } else {
        return;
      }
    } else {
      level = selectValue;
    }
    
    let cost = SpellPoints.withActorData(settings.spellPointsCosts[level], actor);
    let newText = `${CONFIG.DND5E.spellLevels[level]} (${game.i18n.format("dnd5e-spellpoints.spellCost", {amount: cost, SpellPoints: settings.spResource})})`
    if (selectValue != 'pact' || settings.warlockUseSp) {
      $(this).text(newText);
    }
  })
  
  if (level == 'none')
    return;

  /** Calculate spell point cost and warn user if they have none left */
  const maxSpellPoints = window.pr.api.get('points_mana_max');
  const actualSpellPoints = window.pr.api.get('points_mana');
  
  let spellPointCost = SpellPoints.withActorData(SpellPoints.settings.spellPointsCosts[baseSpellLvl], actor);
  
  if (actualSpellPoints - spellPointCost < 0) {
    const messageNotEnough = game.i18n.format("dnd5e-spellpoints.youNotEnough", {SpellPoints: this.settings.spResource });
    $('#ability-use-form', html).append('<div class="spError">'+messageNotEnough+'</div>');
  }

  let copyButton = $('.dialog-button', html).clone();
  $('.dialog-button', html).addClass('original').hide();
  copyButton.addClass('copy');
  $('.dialog-buttons', html).append(copyButton);

  html.on('click','.dialog-button.copy', function(e){
    /** if not consumeSlot we ignore cost, go on and cast or if variant active **/
    if (!$('input[name="consumeSlot"]',html).prop('checked') || SpellPoints.settings.spEnableVariant) {
      $('.dialog-button.original', html).trigger( "click" );
    } else if ($('select[name="level"]', html).length > 0) {
      let spellLvl = $('select[name="level"]', html).val();
      if (actualSpellPoints - spellPointCost < 0) {
        ui.notifications.error("You don't have enough: '" + SpellPoints.settings.spResource + "' to cast this spell");
        dialog.close();
      } else {
        $('.dialog-button.original', html).trigger( "click" );
      }
    }
  })
}

/**
 * Calculates the maximum spell points for an actor based on custom formulas.
 * @param {object} actor The actor used for variables.
 * @return {number} The calculated maximum spell points.
 */
static _calculateSpellPointsCustom(actor){
  let SpellPointsMax = SpellPoints.withActorData(SpellPoints.settings.spCustomFormulaBase, actor);

  let hasSpellSlots = false;
  let spellPointsFromSlots = 0;
  for (let [slotLvlTxt, slot] of Object.entries(actor.system.spells)) {
    let slotLvl;
    if (slotLvlTxt == 'pact') {
      slotLvl = slot.level;
    } else {
      slotLvl = parseInt(slotLvlTxt.replace(/\D/g, ''));
    }

    if(slotLvl == 0) {
      continue;
    }

    spellPointsFromSlots += slot.max * SpellPoints.withActorData(SpellPoints.settings.spellPointsCosts[slotLvl], actor);
    if (slot.max > 0) {
      hasSpellSlots = true;
    }
  }

  if (!hasSpellSlots) {
    return 0;
  }

  SpellPointsMax += spellPointsFromSlots * SpellPoints.withActorData(SpellPoints.settings.spCustomFormulaSlotMultiplier, actor);

  return SpellPointsMax;
}

/**
 * Calculates the maximum spell points for an actor based on a fixed map of
 * spellcasting level to maximum spell points. Builds up a total spellcasting
 * level based on the level of each spellcasting class according to
 * Multiclassing rules.
 * @param {object} item The class item of the actor.
 * @param {object} updates The details of how the class item was udpated.
 * @param {object} actor The actor used for variables.
 * @return {number} The calculated maximum spell points.
 */
static _calculateSpellPointsFixed(item, updates, actor){
  /* not an update? **/
  let changedClassLevel = null;
  let changedClassID = null;
  let levelUpdated = false;
  if (getProperty(updates.data, 'levels')) {
    const oldClassLevel = getProperty(item.data, 'levels');
    changedClassLevel = getProperty(updates.data, 'levels');
    changedClassID =  getProperty(item.data, '_id');
    levelUpdated = true;
  }

  const classDroppedName = getProperty(item, 'name');

  // check if this is the orignal name or localized with babele
  if (getProperty(item, 'flags.babele.translated')){
    let originalName = getProperty(item, 'flags.babele.originalName');
  } else {
    let originalName = classDroppedName;
  }

  const classItem = actor.items.getName(classDroppedName);

  let SpellPointsMax = 0;

  // check for multiclasses
  const actorClasses = actor.items.filter(i => i.type === "class");

  let spellcastingClassCount = 0;
  const spellcastingLevels = {
    full: [],
    half: [],
    artificer: [],
    third: []
  }

  for (let c of actorClasses){
    /* spellcasting: pact; full; half; third; artificier; none; **/
    let spellcasting = c.data.data.spellcasting.progression;
    let level = c.data.data.levels;

    // get updated class new level
    if (levelUpdated && c.data._id == changedClassID)
      level = changedClassLevel;

    if (spellcastingLevels[spellcasting] != undefined) {
      spellcastingLevels[spellcasting].push(level);
      spellcastingClassCount++;
    }

  }

  let totalSpellcastingLevel = 0
  totalSpellcastingLevel += spellcastingLevels['full'].reduce((sum, level) => sum + level, 0)
  totalSpellcastingLevel += spellcastingLevels['artificer'].reduce((sum, level) => sum + Math.ceil(level/2), 0);
  // Half and third casters only round up if they do not multiclass into other spellcasting classes and if they
  // have enough levels to obtain the spellcasting feature.
  if (spellcastingClassCount == 1 && (spellcastingLevels['half'][0] >= 2 || spellcastingLevels['third'][0] >= 3)) {
    totalSpellcastingLevel += spellcastingLevels['half'].reduce((sum, level) => sum + Math.ceil(level/2), 0);
    totalSpellcastingLevel += spellcastingLevels['third'].reduce((sum, level) => sum + Math.ceil(level/3), 0);
  } else {
    totalSpellcastingLevel += spellcastingLevels['half'].reduce((sum, level) => sum + Math.floor(level/2), 0);
    totalSpellcastingLevel += spellcastingLevels['third'].reduce((sum, level) => sum + Math.floor(level/3), 0);
  }

  return parseInt(SpellPoints.settings.spellPointsByLevel[totalSpellcastingLevel]) || 0
}

/** Spell Points Automatic Calculation on class level update or new class */
static calculateSpellPoints(item, updates, isDifferent) {
    const actor = item.parent;

    if (!SpellPoints.isModuleActive() || !SpellPoints.isActorCharacter(actor))
    return true;

    if (!SpellPoints.settings.spAutoSpellpoints) {
      return true;
    }
    /* if mixedMode active Check if SpellPoints is enabled for this actor */
    if (SpellPoints.settings.spMixedMode && !SpellPoints.isMixedActorSpellPointEnabled(actor))
      return true;

    /* updating or dropping a class item */
    if (item.type !== 'class')
      return true;

    let spellPointResource = window.pr.api.get('points_mana');

    const actorName = actor.data.name;

    if (!spellPointResource) {
      ui.notifications.error("SPELLPOINTS: Cannot find resource '" + SpellPoints.settings.spResource + "' on " + actorName + " character sheet!");
      return true;
    }

    const isCustom = SpellPoints.settings.isCustom.toString().toLowerCase() == 'true';
    const SpellPointsMax = isCustom ? SpellPoints._calculateSpellPointsCustom(actor) : SpellPoints._calculateSpellPointsFixed(item, updates, actor)

    if (SpellPointsMax > 0) {
      let updateActor = {[`data.resources.${spellPointResource.key}.max`] : SpellPointsMax};
      actor.update(updateActor);
      ui.notifications.info("SPELLPOINTS: Found resource '" + SpellPoints.settings.spResource + "' on " + actorName + " character sheet! Your Maximum "+ SpellPoints.settings.spResource +" have been updated.");
    }
  return true;
}

/**
* mixed Mode add a button to spell sheet
*
**/

static mixedMode(app, html, data){
  if (!this.isModuleActive() || !this.settings.spMixedMode || data.actor.type != "character") {
    return;
  }

  let checked = "";
  if (SpellPoints.isMixedActorSpellPointEnabled(data.actor)) {
    checked = "checked";
  }

  let spellPointUseOnSheetLabel = game.i18n.localize('dnd5e-spellpoints.use-spellpoints');

  let html_checkbox = '<div class="spEnable flexrow ">';
  html_checkbox += '<div class="no-edit"><i class="fas fa-magic"></i> ' + spellPointUseOnSheetLabel + '</div>';
  html_checkbox += '<label class="edit-allowed"><i class="fas fa-magic"></i>&nbsp;';
  html_checkbox += spellPointUseOnSheetLabel;
  html_checkbox += '<input name="flags.dnd5espellpoints.enabled" '+checked+' class="spEnableInput visually-hidden" type="checkbox" value="1">';
  html_checkbox += ' <i class="spEnableCheck fas"></i>';
  html_checkbox += '</label></div>';
  $('.tab.features', html).prepend(html_checkbox);
}

} /** END SpellPoint Class **/


/**
* SPELL POINTS APPLICATION SETTINGS FORM
*/
class SpellPointsForm extends FormApplication {
static get defaultOptions() {
  return mergeObject(super.defaultOptions, {
    title: game.i18n.localize('dnd5e-spellpoints.form-title'),
    id: 'spellpoints-form',
    template: `modules/${MODULE_NAME}/templates/spellpoint-config.html`,
    width: 500,
    closeOnSubmit: true
  });
}

/**
 * Get the data used for filling out the Form. This is composed of the following
 * in order of priority
 *   1) Settings defined by the user
 *   2) Default settings
 *   3) The available formulas
 */
getData(options) {
  let data = mergeObject(
    {spFormulas: Object.fromEntries(Object.keys(SpellPoints.formulas).map(formula_key => [formula_key, game.i18n.localize(`dnd5e-spellpoints.${formula_key}`)]))
    }, 
    this.reset ? mergeObject(SpellPoints.defaultSettings,{requireSave:true}) : mergeObject(SpellPoints.settings, {requireSave:false})
  );
  this.reset = false;
  return data;
}

onReset() {
  this.reset = true;
  this.render();
}

/**
 * Edits the visiblity of html elements within the Form based on whether the
 * current formula is a custom formula.
 * @param {boolean} isCustom A boolean flag that marks if the current formula is a custom formula.
 */
setCustomOnlyVisibility(isCustom) {
  const displayValue = isCustom ? 'block' : 'none';
  const customElements = this.element[0].querySelectorAll('.spell-points-custom-only')
  for (let elementIndex = 0, customElement; customElement = customElements[elementIndex]; elementIndex++) {
    customElement.style.display = displayValue;
  }
}

_updateObject(event, formData) {
  return __awaiter(this, void 0, void 0, function* () {
    let settings = mergeObject(SpellPoints.settings, formData, { insertKeys: true, insertValues: true });
    yield game.settings.set(MODULE_NAME, 'settings', settings);
  });
}
activateListeners(html) {
  super.activateListeners(html);
  html.find('button[name="reset"]').click(this.onReset.bind(this));
}

/**
 * Method executed whenever an input is changed within the Form. This method
 * watches only for changes in the spFormula select box. When a different
 * formula is selected, it will overwrite all fields specified by that formula.
 * The visiblity of custom formulas is also set based on if the new formula is
 * a custom formula.
 * @param {object} event The data detailing the change in the form.
 */
_onChangeInput(event){
  const input_name = event.originalEvent.path[0].name;
  if (input_name == "spFormula") {
    const input_value = event.originalEvent.path[0].value;
    const formulaOverrides = SpellPoints.formulas[input_value]
    const isCustom = (formulaOverrides.isCustom || "").toString().toLowerCase() == "true"
    for (let elementName in formulaOverrides) {
      if (formulaOverrides[elementName] instanceof Object) {
        for (let elementSubName in formulaOverrides[elementName]) {
          super.element[0].querySelector(`[name='${elementName}.${elementSubName}']`).value = formulaOverrides[elementName][elementSubName];
        }
      } else {
        super.element[0].querySelector(`[name='${elementName}']`).value = formulaOverrides[elementName];
      }
    }

    this.setCustomOnlyVisibility(isCustom);
  }
}
} /** end SpellPointForm **/

Hooks.on('init', () => {
//console.log('SpellPoints init');

/** should spellpoints be enabled */
game.settings.register(MODULE_NAME, "spEnableSpellpoints", {
  name: "Enable Spell Points system",
  hint: "Enables or disables spellpoints for casting spells, this will override the slot cost for player tokens.",
  scope: "world",
  config: true,
  default: false,
  type: Boolean,
  /*onChange: spEnableSpellpoints => {
    window.location.reload();
  }*/
});

game.settings.registerMenu(MODULE_NAME, MODULE_NAME, {
  name: "dnd5e-spellpoints.form",
  label: "dnd5e-spellpoints.form-title",
  hint: "dnd5e-spellpoints.form-hint",
  icon: "fas fa-magic",
  type: SpellPointsForm,
  restricted: true
});

game.settings.register(MODULE_NAME, "settings", {
  name: "Spell Points Settings",
  scope: "world",
  default: SpellPoints.defaultSettings,
  type: Object,
  config: false,
  //onChange: (x) => window.location.reload()
});

let _betterRollsActive = false;
for (const mod of game.data.modules) {
  if (mod.id == "betterrolls5e" && mod.active) {
    _betterRollsActive = true;
    break;
  }
}

});

// collate all preUpdateActor hooked functions into a single hook call
Hooks.on("preUpdateActor", async (actor, update, options, userId) => {
update = SpellPoints.castSpell(actor, update);
});

/** spell launch dialog **/
Hooks.on("renderAbilityUseDialog", async (dialog, html, formData) => {
SpellPoints.checkDialogSpellPoints(dialog, html, formData);
})

Hooks.on("updateItem", SpellPoints.calculateSpellPoints);
Hooks.on("createItem", SpellPoints.calculateSpellPoints);

Hooks.on("renderActorSheet5e", (app, html, data) => {
SpellPoints.mixedMode(app, html, data);
});

/**
* Hook that is triggered after the SpellPointsForm has been rendered. This
* sets the visiblity of the custom formula fields based on if the current
* formula is a custom formula.
*/
Hooks.on('renderSpellPointsForm', (spellPointsForm, html, data) => {
const isCustom = (data.isCustom || "").toString().toLowerCase() == "true"
spellPointsForm.setCustomOnlyVisibility(isCustom)
})
