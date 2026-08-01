import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import CardsForm from './form';

// i18next is not initialised in tests, so t() hands back the key
const KEY = {
  folder: 'cards.controls.quick-actions.folder',
  spotify: 'cards.controls.quick-actions.spotify',
  allActions: 'cards.controls.quick-actions.all-actions',
  actionSelect: 'cards.controls.controls-selector.label',
  save: 'general.buttons.save',
};

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderForm = (props = {}) => {
  const setActionData = jest.fn();
  render(
    <MemoryRouter>
      <CardsForm
        title="register"
        cardId="12345"
        actionData={{}}
        setActionData={setActionData}
        allowQuickActions
        {...props}
      />
    </MemoryRouter>
  );
  return { setActionData };
};

describe('card registration', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('offers folder and spotify directly after a card was swiped', () => {
    renderForm();

    expect(screen.getByText(KEY.folder)).toBeInTheDocument();
    expect(screen.getByText(KEY.spotify)).toBeInTheDocument();
    // the action dropdown stays out of the way until it is asked for
    expect(screen.queryByText(KEY.actionSelect)).not.toBeInTheDocument();
    expect(screen.queryByText(KEY.save)).not.toBeInTheDocument();
  });

  it('goes to the folder view of the library for the selected card', async () => {
    renderForm();

    await userEvent.click(screen.getByText(KEY.folder));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/library/folders',
      search: '?isSelecting=true&cardId=12345',
    });
  });

  it('selects the uri command when spotify is chosen', async () => {
    const { setActionData } = renderForm();

    await userEvent.click(screen.getByText(KEY.spotify));

    expect(setActionData).toHaveBeenCalledWith({
      action: 'play_music',
      command: { name: 'play_uri', args: { uri: '' } },
    });
  });

  it('falls back to the full action list on request', async () => {
    renderForm();

    await userEvent.click(screen.getByText(KEY.allActions));

    expect(screen.getByText(KEY.actionSelect)).toBeInTheDocument();
  });

  it('keeps the full editor when editing an existing card', () => {
    renderForm({
      allowQuickActions: false,
      actionData: { action: 'play_music', command: { name: 'play_folder', args: { folder: 'Auto Blubberbumm' } } },
    });

    expect(screen.getByText(KEY.actionSelect)).toBeInTheDocument();
    expect(screen.queryByText(KEY.folder)).not.toBeInTheDocument();
  });
});
