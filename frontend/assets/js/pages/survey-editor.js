if (!requireAuth()) throw '';

const params = new URLSearchParams(window.location.search);
const surveyId = params.get('survey');

const state = {
  survey: null,
  questions: [],
  questionForms: [],
  biasIssues: [],
  autoAiDone: false,
  loading: false,
};

const QUESTION_TYPES = [
  ['text', 'Text'],
  ['rating', 'Rating'],
  ['nps', 'NPS'],
  ['yes_no', 'Yes / No'],
  ['single_choice', 'Single Choice'],
  ['multi_choice', 'Multi Choice'],
];

function buildEditorShell() {
  return buildSidebar('surveys', 'Survey Editor') + `
    <div class="page-header">
      <div>
        <div class="breadcrumb" style="margin-bottom:8px"><a href="surveys.html">Surveys</a><span>&gt;</span><span class="crumb-current">Editor</span></div>
        <h1 class="page-title" id="editor-title">Survey Editor</h1>
        <p class="page-subtitle" id="editor-subtitle">Loading survey details...</p>
      </div>
      <div class="page-actions">
        <a class="btn btn-ghost" href="surveys.html">Back to Surveys</a>
        <button class="btn btn-primary" id="btn-publish">${icon('globe')} Publish</button>
      </div>
    </div>

    <div class="editor-grid">
      <section class="card editor-panel">
        <div class="card-header"><span class="card-title">Survey Details</span><span id="survey-status-wrap" class="status-chip-row"></span></div>
        <div class="card-body">
          <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="meta-title"/></div>
          <div class="form-group"><label class="form-label">Goal</label><textarea class="form-textarea" id="meta-goal" rows="4"></textarea></div>
          <div class="stack-grid-2">
            <div class="form-group"><label class="form-label">Target Audience</label><input class="form-input" id="meta-audience"/></div>
            <div class="form-group"><label class="form-label">Language</label><select class="form-select" id="meta-language"><option value="en">English</option><option value="fr">French</option><option value="es">Spanish</option><option value="de">German</option></select></div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="btn-save-meta">Save Details</button>
            <button class="btn btn-ghost" id="btn-preview-public">Preview Public</button>
          </div>
          <div id="share-wrap" style="margin-top:14px"></div>
        </div>
      </section>

      <section class="card editor-panel">
        <div class="card-header"><span class="card-title">AI Question Generation</span></div>
        <div class="card-body">
          <div class="stack-grid-2">
            <div class="form-group"><label class="form-label">Question Count</label><input class="form-input" id="ai-count" type="number" min="3" max="20" value="8"/></div>
            <div class="form-group"><label class="form-label">Tone</label><select class="form-select" id="ai-tone"><option value="neutral">Neutral</option><option value="friendly">Friendly</option><option value="professional">Professional</option><option value="conversational">Conversational</option></select></div>
          </div>
          <div class="form-group"><label class="form-label">Constraints</label><textarea class="form-textarea" id="ai-constraints" rows="3" placeholder="One constraint per line, for example: avoid leading language"></textarea></div>
          <div class="alert alert-info">${icon('sparkles')} Running AI generation replaces the current draft questions for this survey.</div>
          <div class="page-actions">
            <button class="btn btn-ai" id="btn-run-ai">${icon('sparkles')} Generate Questions</button>
            <button class="btn btn-ghost" id="btn-run-bias">${icon('checkCircle')} Review Bias</button>
          </div>
          <div id="bias-results" style="margin-top:14px"></div>
        </div>
      </section>
    </div>

    <section class="card editor-panel" style="margin-top:18px">
      <div class="card-header">
        <span class="card-title">Questions</span>
        <button class="btn btn-primary btn-sm" id="btn-add-question">${icon('plus')} Add Question</button>
      </div>
      <div class="card-body">
        <div id="question-list"></div>
      </div>
    </section>
  ` + closeSidebar();
}

document.getElementById('root').innerHTML = buildEditorShell();
initSidebar();

function requiresOptions(type) {
  return type === 'single_choice' || type === 'multi_choice';
}

function makeEmptyQuestion(order) {
  return {
    tempId: 'tmp-' + Math.random().toString(36).slice(2, 10),
    type: 'text',
    text: '',
    description: '',
    required: true,
    order,
    options: [],
  };
}

function normalizeQuestionForms(questions) {
  state.questionForms = questions.map((question, index) => ({
    id: question.id,
    tempId: question.tempId,
    type: question.type || 'text',
    text: question.text || '',
    description: question.description || '',
    required: question.required !== false,
    order: question.order || index + 1,
    options: (question.options || []).map((option, optionIndex) => ({
      id: option.id,
      label: option.label || '',
      value: option.value || '',
      order: option.order || optionIndex + 1,
    })),
  }));
}

function questionKey(question) {
  return question.id || question.tempId;
}

function updateSurveyHeader() {
  if (!state.survey) return;
  document.getElementById('editor-title').textContent = state.survey.title || 'Survey Editor';
  document.getElementById('editor-subtitle').textContent = 'Manage metadata, draft questions, AI generation, and publishing.';
  document.getElementById('survey-status-wrap').innerHTML = badge(state.survey.status || 'draft');
  document.getElementById('btn-publish').disabled = state.questions.length === 0;
}

function renderMeta() {
  if (!state.survey) return;
  document.getElementById('meta-title').value = state.survey.title || '';
  document.getElementById('meta-goal').value = state.survey.goal || '';
  document.getElementById('meta-audience').value = state.survey.target_audience || '';
  document.getElementById('meta-language').value = state.survey.language || 'en';
  const shareWrap = document.getElementById('share-wrap');
  if (state.survey.public_slug) {
    const url = buildPublicSurveyUrl(state.survey.public_slug);
    shareWrap.innerHTML = `
      <div class="share-box">
        <label class="form-label">Public Link</label>
        <div class="action-group">
          <input class="form-input" value="${url}" readonly/>
          <button class="btn btn-ghost btn-sm" id="btn-copy-public">Copy</button>
        </div>
      </div>`;
    document.getElementById('btn-copy-public').onclick = () => {
      navigator.clipboard?.writeText(url);
      toast('success', 'Public link copied');
    };
  } else {
    shareWrap.innerHTML = '<div class="inline-note">Publish the survey to generate a public response link.</div>';
  }
}

function renderBiasIssues() {
  const root = document.getElementById('bias-results');
  if (!state.biasIssues.length) {
    root.innerHTML = '';
    return;
  }
  root.innerHTML = '<div class="alert alert-warn">' + state.biasIssues.length + ' issue(s) found</div>' + state.biasIssues.map(issue => `
    <div class="card bias-issue-card">
      <div class="card-body">
        <div class="bias-issue-head">${badge(issue.severity)}<span class="inline-note">${issue.reason}</span></div>
        <div class="bias-issue-copy"><strong>Suggested rewrite:</strong> ${issue.suggested_rewrite}</div>
        ${issue.question_id ? `<button class="btn btn-primary btn-sm" data-action="apply-rewrite" data-question-id="${issue.question_id}" data-rewrite="${encodeURIComponent(issue.suggested_rewrite || '')}">Apply rewrite</button>` : ''}
      </div>
    </div>`).join('');
}

function renderQuestions() {
  const list = document.getElementById('question-list');
  state.questionForms = state.questionForms.map((question, index) => ({ ...question, order: index + 1 }));
  if (!state.questionForms.length) {
    list.className = '';
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('clipboard') + '</div><p class="empty-title">No questions yet</p><p class="empty-desc">Use AI Generate or add a manual question to begin building this survey.</p></div>';
    return;
  }

  list.className = 'question-stack';
  list.innerHTML = state.questionForms.map((question, index) => {
    const key = questionKey(question);
    const optionsHtml = requiresOptions(question.type)
      ? `<div class="option-stack" data-options-wrap="${key}">
          ${(question.options || []).map((option, optionIndex) => `
            <div class="option-row" data-option-row="${key}:${optionIndex}">
              <div class="form-group" style="margin-bottom:0"><label class="form-label">Option label</label><input class="form-input" data-field="option-label" data-key="${key}" data-option-index="${optionIndex}" value="${option.label || ''}"/></div>
              <div class="form-group" style="margin-bottom:0"><label class="form-label">Option value</label><div class="option-value-group"><input class="form-input" data-field="option-value" data-key="${key}" data-option-index="${optionIndex}" value="${option.value || ''}"/><button class="btn btn-danger btn-sm" data-action="remove-option" data-key="${key}" data-option-index="${optionIndex}">Remove</button></div></div>
            </div>`).join('')}
          <button class="btn btn-ghost btn-sm" data-action="add-option" data-key="${key}">${icon('plus')} Add Option</button>
        </div>`
      : '';

    return `
      <div class="card question-editor-card" data-question-key="${key}">
        <div class="card-header">
          <div class="question-editor-top">
            <div class="question-editor-title">
              <span class="question-editor-number">${index + 1}</span>
              <span class="card-title">Question ${index + 1}</span>
            </div>
            <div class="action-group">
            <span class="saved-state">${question.id ? 'Saved' : 'Unsaved'}</span>
            <button class="btn btn-danger btn-sm" data-action="delete-question" data-key="${key}">Delete</button>
          </div>
          </div>
        </div>
        <div class="card-body">
          <div class="question-card-grid">
            <div class="form-group"><label class="form-label">Question text</label><input class="form-input" data-field="text" data-key="${key}" value="${question.text || ''}"/></div>
            <div class="form-group"><label class="form-label">Type</label><select class="form-select" data-field="type" data-key="${key}">${QUESTION_TYPES.map(([value, label]) => `<option value="${value}" ${question.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
          </div>
          <div class="question-card-grid">
            <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" rows="3" data-field="description" data-key="${key}">${question.description || ''}</textarea></div>
            <div class="form-group"><label class="form-label">Settings</label><div class="question-settings-box"><label class="question-settings-toggle"><input type="checkbox" data-field="required" data-key="${key}" ${question.required ? 'checked' : ''}/> Required</label></div></div>
          </div>
          ${optionsHtml}
          <div class="page-actions question-card-actions">
            <button class="btn btn-primary btn-sm" data-action="save-question" data-key="${key}">Save Question</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function fillStateFromDetail(detail) {
  state.survey = detail.survey;
  state.questions = detail.questions || [];
  normalizeQuestionForms(state.questions);
  updateSurveyHeader();
  renderMeta();
  renderQuestions();
  renderBiasIssues();
}

async function loadSurveyDetail() {
  if (!surveyId) {
    document.getElementById('editor-title').textContent = 'Survey not found';
    document.getElementById('editor-subtitle').textContent = 'Missing survey id in the URL.';
    return;
  }
  const response = await api.getSurvey(surveyId);
  if (!response.ok) {
    toast('error', 'Unable to load survey', response.error.message);
    document.getElementById('editor-subtitle').textContent = response.error.message;
    return;
  }
  fillStateFromDetail(response.data);
  await maybeAutoRunAi();
}

function getPendingAiKey() {
  return 'if_pending_ai:' + surveyId;
}

function readAiForm() {
  return {
    goal: document.getElementById('meta-goal').value.trim() || state.survey.goal,
    target_audience: document.getElementById('meta-audience').value.trim() || null,
    question_count: Number(document.getElementById('ai-count').value || 8),
    tone: document.getElementById('ai-tone').value || 'neutral',
    constraints: document.getElementById('ai-constraints').value.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
  };
}

async function maybeAutoRunAi() {
  if (state.autoAiDone) return;
  const raw = sessionStorage.getItem(getPendingAiKey());
  if (!raw) return;
  state.autoAiDone = true;
  sessionStorage.removeItem(getPendingAiKey());
  try {
    const config = JSON.parse(raw);
    document.getElementById('ai-count').value = config.question_count || 8;
    document.getElementById('ai-tone').value = config.tone || 'neutral';
    document.getElementById('ai-constraints').value = (config.constraints || []).join('\n');
    await runAiGeneration(config, true);
  } catch (error) {
    toast('error', 'Unable to auto-run AI generation');
  }
}

async function saveMetadata() {
  const payload = {
    title: document.getElementById('meta-title').value.trim(),
    goal: document.getElementById('meta-goal').value.trim(),
    target_audience: document.getElementById('meta-audience').value.trim() || null,
    language: document.getElementById('meta-language').value,
  };
  if (!payload.title || payload.title.length < 3) { toast('error', 'Title must be at least 3 characters'); return; }
  if (!payload.goal) { toast('error', 'Goal is required'); return; }
  const response = await api.updateSurvey(surveyId, payload);
  if (!response.ok) { toast('error', 'Unable to save survey', response.error.message); return; }
  state.survey = response.data;
  updateSurveyHeader();
  renderMeta();
  toast('success', 'Survey details saved');
}

async function runAiGeneration(config, silent) {
  const payload = config || readAiForm();
  if (!payload.goal) { toast('error', 'Add a survey goal before running AI generation'); return; }
  const button = document.getElementById('btn-run-ai');
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> Generating...';
  const response = await api.aiGenerate(surveyId, payload);
  button.disabled = false;
  button.innerHTML = icon('sparkles') + ' Generate Questions';
  if (!response.ok) {
    toast('error', 'AI generation failed', response.error.message);
    return;
  }
  await loadSurveyDetail();
  if (!silent) toast('success', 'Questions generated', 'The draft questions were refreshed from AI output.');
}

function getQuestionForm(key) {
  return state.questionForms.find(question => questionKey(question) === key);
}

function syncField(key, field, value) {
  const question = getQuestionForm(key);
  if (!question) return;
  question[field] = value;
}

function addManualQuestion() {
  state.questionForms.push(makeEmptyQuestion(state.questionForms.length + 1));
  renderQuestions();
}

function addOptionToQuestion(key) {
  const question = getQuestionForm(key);
  if (!question) return;
  question.options.push({ label: '', value: '', order: question.options.length + 1 });
  renderQuestions();
}

function removeOptionFromQuestion(key, optionIndex) {
  const question = getQuestionForm(key);
  if (!question) return;
  question.options.splice(optionIndex, 1);
  question.options = question.options.map((option, index) => ({ ...option, order: index + 1 }));
  renderQuestions();
}

function buildQuestionPayload(question) {
  const payload = {
    type: question.type,
    text: (question.text || '').trim(),
    description: (question.description || '').trim() || null,
    required: question.required !== false,
    order: question.order,
    options: [],
  };
  if (!payload.text || payload.text.length < 3) {
    throw new Error('Question text must be at least 3 characters.');
  }
  if (requiresOptions(question.type)) {
    const options = (question.options || []).map((option, index) => ({
      label: (option.label || '').trim(),
      value: (option.value || '').trim() || (option.label || '').trim(),
      order: index + 1,
    })).filter(option => option.label && option.value);
    if (!options.length) {
      throw new Error('Choice questions need at least one option.');
    }
    payload.options = options;
  }
  return payload;
}

async function saveQuestion(key) {
  const question = getQuestionForm(key);
  if (!question) return;
  let payload;
  try {
    payload = buildQuestionPayload(question);
  } catch (error) {
    toast('error', 'Question validation', error.message);
    return;
  }

  const response = question.id
    ? await api.updateQuestion(surveyId, question.id, payload)
    : await api.addQuestion(surveyId, payload);
  if (!response.ok) {
    toast('error', 'Unable to save question', response.error.message);
    return;
  }
  await loadSurveyDetail();
  toast('success', 'Question saved');
}

async function deleteQuestion(key) {
  const question = getQuestionForm(key);
  if (!question) return;
  if (question.id) {
    const response = await api.deleteQuestion(surveyId, question.id);
    if (!response.ok && response.status !== 204) {
      toast('error', 'Unable to delete question', response.error.message);
      return;
    }
    await loadSurveyDetail();
  } else {
    state.questionForms = state.questionForms.filter(item => questionKey(item) !== key);
    renderQuestions();
  }
  toast('success', 'Question removed');
}

async function reviewBias() {
  const response = await api.biasCheck(surveyId, {});
  if (!response.ok) {
    toast('error', 'Bias review failed', response.error.message);
    return;
  }
  state.biasIssues = response.data.issues || [];
  renderBiasIssues();
  if (!state.biasIssues.length) toast('success', 'No bias issues found');
}

async function applyRewrite(questionId, rewrite) {
  const question = state.questions.find(item => item.id === questionId);
  if (!question) return;
  const payload = {
    type: question.type,
    text: rewrite,
    description: question.description || null,
    required: question.required,
    order: question.order,
    options: (question.options || []).map(option => ({
      label: option.label,
      value: option.value,
      order: option.order,
    })),
  };
  const response = await api.updateQuestion(surveyId, questionId, payload);
  if (!response.ok) {
    toast('error', 'Unable to apply rewrite', response.error.message);
    return;
  }
  toast('success', 'Suggested rewrite applied');
  await loadSurveyDetail();
  await reviewBias();
}

async function publishSurveyFromEditor() {
  const response = await api.publishSurvey(surveyId, {});
  if (!response.ok) {
    toast('error', 'Unable to publish survey', response.error.message);
    return;
  }
  state.survey.status = 'published';
  state.survey.public_slug = response.data.public_slug;
  updateSurveyHeader();
  renderMeta();
  toast('success', 'Survey published');
}

function openPreview() {
  if (!state.survey?.public_slug) {
    toast('info', 'Publish the survey first to preview the public form');
    return;
  }
  window.open(buildPublicSurveyUrl(state.survey.public_slug), '_blank');
}

document.getElementById('btn-save-meta').addEventListener('click', saveMetadata);
document.getElementById('btn-run-ai').addEventListener('click', () => runAiGeneration());
document.getElementById('btn-run-bias').addEventListener('click', reviewBias);
document.getElementById('btn-add-question').addEventListener('click', addManualQuestion);
document.getElementById('btn-publish').addEventListener('click', publishSurveyFromEditor);
document.getElementById('btn-preview-public').addEventListener('click', openPreview);

document.addEventListener('input', event => {
  const target = event.target;
  const key = target.dataset.key;
  if (!key) return;
  const field = target.dataset.field;
  if (field === 'option-label' || field === 'option-value') {
    const question = getQuestionForm(key);
    if (!question) return;
    const optionIndex = Number(target.dataset.optionIndex);
    if (!question.options[optionIndex]) return;
    question.options[optionIndex][field === 'option-label' ? 'label' : 'value'] = target.value;
    return;
  }
  if (field === 'required') {
    syncField(key, field, target.checked);
    return;
  }
  syncField(key, field, target.value);
});

document.addEventListener('change', event => {
  const target = event.target;
  const key = target.dataset.key;
  if (!key) return;
  const field = target.dataset.field;
  if (field === 'type') {
    syncField(key, field, target.value);
    const question = getQuestionForm(key);
    if (question && !requiresOptions(question.type)) question.options = [];
    renderQuestions();
    return;
  }
  if (field === 'required') {
    syncField(key, field, target.checked);
  }
});

document.addEventListener('click', event => {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const key = actionEl.dataset.key;
  if (action === 'add-option') addOptionToQuestion(key);
  if (action === 'remove-option') removeOptionFromQuestion(key, Number(actionEl.dataset.optionIndex));
  if (action === 'save-question') saveQuestion(key);
  if (action === 'delete-question') deleteQuestion(key);
  if (action === 'apply-rewrite') applyRewrite(actionEl.dataset.questionId, decodeURIComponent(actionEl.dataset.rewrite || ''));
});

loadSurveyDetail();
