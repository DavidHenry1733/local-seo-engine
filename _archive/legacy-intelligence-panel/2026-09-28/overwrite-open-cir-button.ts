/**
 * CLASSIFICATION D — SUPERSEDED / DEAD PRODUCTION
 * Archived 2026-09-28.
 *
 * This block lived at the end of renderCustomerDetail. It tried to turn the
 * Intelligence panel's view control (#openCirBtn, "Open Commercial Intelligence",
 * openCommercialIntelligenceReview) into the workflow execution control.
 *
 * The header already read currentStageLabel + nextAction, so it could show
 * "Next: Generate Competitor Analysis" while this overwrite left the panel on
 * the view button whenever it did not run. Replacing the view button also
 * removed the distinction between opening Commercial Intelligence and running
 * the current stage.
 *
 * Production now renders #udIntelligenceRunBtn from
 * canonicalIntelligenceWorkflowAction inside renderUnifiedDashboardShell.
 * This file is not imported, routed, bundled, or called.
 */
export const supersededIntelligencePanelOverwrite = `
  const intelStage=customerStage(c);
  if(intelStage==='competitor_analysis'||intelStage==='local_market_intelligence'||intelStage==='generate_growth_intelligence'){
    const intelAction=orch.stageActionId||'';
    const intelLabel=(c.nextAction&&c.nextAction!=='—')?c.nextAction:(orch.continueLabel||'Continue Workflow');
    const giBtn=document.getElementById('openCirBtn');
    if(giBtn&&(intelAction==='orchestrate_competitor_analysis'||intelAction==='orchestrate_local_market_intelligence'||intelAction==='orchestrate_growth_intelligence')){
      giBtn.textContent=intelLabel;
      giBtn.setAttribute('onclick','continueWorkflow("'+intelAction+'")');
    }
  }
`;
