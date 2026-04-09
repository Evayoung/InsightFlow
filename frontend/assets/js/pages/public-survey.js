const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');
let surveyDetail = null;

function renderState(title, copy, actionHtml = '') {
  document.getElementById('survey-root').innerHTML = `
    <div class="state-block">
      <h2>${title}</h2>
      <p>${copy}</p>
      ${actionHtml}
    </div>
  `;
}

function renderQuestion(question, index) {
  const required = question.required ? '<span class="required-mark">*</span>' : '';
  const description = question.description ? `<p class="question-copy">${question.description}</p>` : '';
  const heading = `
    <div class="question-head">
      <span class="question-number">${index + 1}</span>
      <div class="question-copy-wrap">
        <h3 class="question-title">${question.text} ${required}</h3>
        ${description}
      </div>
    </div>
  `;

  if (question.type === 'text') {
    return `
      <section class="question-block">
        ${heading}
        <textarea class="form-textarea" rows="4" data-question-id="${question.id}" data-question-type="${question.type}" placeholder="Type your answer here"></textarea>
      </section>
    `;
  }

  if (question.type === 'rating') {
    return `
      <section class="question-block">
        ${heading}
        <div class="scale-grid">
          ${[1,2,3,4,5].map(value => `
            <label class="scale-option">
              <input type="radio" name="q-${question.id}" value="${value}" data-question-id="${question.id}" data-question-type="${question.type}"/>
              <strong>${value}</strong>
            </label>
          `).join('')}
        </div>
      </section>
    `;
  }

  if (question.type === 'nps') {
    return `
      <section class="question-block">
        ${heading}
        <div class="scale-grid">
          ${Array.from({ length: 11 }, (_, value) => `
            <label class="scale-option">
              <input type="radio" name="q-${question.id}" value="${value}" data-question-id="${question.id}" data-question-type="${question.type}"/>
              <strong>${value}</strong>
            </label>
          `).join('')}
        </div>
      </section>
    `;
  }

  const type = question.type === 'multi_choice' ? 'checkbox' : 'radio';
  const options = question.type === 'yes_no'
    ? [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]
    : (question.options || []).map(option => ({ value: option.value, label: option.label }));

  return `
    <section class="question-block">
      ${heading}
      <div class="choice-list">
        ${options.map(option => `
          <label class="choice-option">
            <input type="${type}" name="q-${question.id}" value="${option.value}" data-question-id="${question.id}" data-question-type="${question.type}"/>
            <span>${option.label}</span>
          </label>
        `).join('')}
      </div>
    </section>
  `;
}

function collectAnswers() {
  const answers = [];
  for (const question of surveyDetail.questions) {
    const selector = `[data-question-id="${question.id}"]`;
    if (question.type === 'text') {
      const value = document.querySelector(selector)?.value.trim() || '';
      if (question.required && !value) throw new Error(`Please answer: ${question.text}`);
      if (value) answers.push({ question_id: question.id, value });
      continue;
    }

    if (question.type === 'multi_choice') {
      const selected = Array.from(document.querySelectorAll(`${selector}:checked`)).map(node => node.value);
      if (question.required && selected.length === 0) throw new Error(`Please answer: ${question.text}`);
      if (selected.length) answers.push({ question_id: question.id, value: selected.join(', ') });
      continue;
    }

    const selected = document.querySelector(`${selector}:checked`);
    const value = selected ? selected.value : '';
    if (question.required && !value) throw new Error(`Please answer: ${question.text}`);
    if (value) answers.push({ question_id: question.id, value });
  }
  return answers;
}

async function submitSurvey(event) {
  event.preventDefault();
  try {
    const answers = collectAnswers();
    const button = document.getElementById('btn-submit-survey');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Submitting...';
    const response = await api.submitResponse(slug, {
      answers,
      respondent_meta: { source: 'public-web' }
    });
    if (!response.ok) {
      button.disabled = false;
      button.textContent = 'Submit Survey';
      if (response.status === 429) {
        renderState('Slow down a little', 'Too many attempts were detected from this browser. Please wait a moment and try again.');
        return;
      }
      toast('error', 'Unable to submit survey', response.error.message);
      return;
    }
    renderState('Thank you for your feedback', 'Your response has been captured successfully. You can close this page now.');
  } catch (error) {
    toast('error', 'Incomplete response', error.message);
  }
}

async function loadSurvey() {
  if (!slug) {
    renderState('Survey link incomplete', 'The survey link is missing a slug. Ask the sender to share the full link.');
    return;
  }

  const response = await api.publicSurvey(slug);
  if (!response.ok) {
    if (response.status === 404) {
      renderState('Survey not found', 'This survey link is no longer available.');
      return;
    }
    if (response.status === 429) {
      renderState('Too many requests', 'Please wait a moment before trying this survey again.');
      return;
    }
    renderState('Survey unavailable', response.error.message || 'We could not load this survey right now.');
    return;
  }

  surveyDetail = response.data;
  const survey = surveyDetail.survey || {};
  const questions = [...(surveyDetail.questions || [])].sort((left, right) => (left.order || 0) - (right.order || 0));
  surveyDetail.questions = questions;

  document.getElementById('survey-title').textContent = survey.title || 'InsightFlow Survey';
  document.getElementById('survey-copy').textContent = survey.description || survey.goal || 'Please take a few moments to answer the questions below.';
  document.getElementById('survey-meta').innerHTML = `
    <span>Status: ${(survey.status || 'published').toUpperCase()}</span>
    <span>${questions.length} question${questions.length === 1 ? '' : 's'}</span>
    <span>Language: ${(survey.language || 'en').toUpperCase()}</span>
  `;

  if ((survey.status || '').toLowerCase() === 'closed') {
    renderState('Survey closed', 'This survey is no longer accepting responses.');
    return;
  }

  document.getElementById('survey-root').innerHTML = `
    <form id="public-survey-form" class="public-form">
      ${questions.map(renderQuestion).join('')}
      <div class="public-form-footer">
        <p class="public-form-note">Your feedback is securely captured and only used for this survey analysis.</p>
        <button class="btn btn-primary" id="btn-submit-survey" type="submit">Submit Survey</button>
      </div>
    </form>
  `;
  document.getElementById('public-survey-form').addEventListener('submit', submitSurvey);
}

loadSurvey();

