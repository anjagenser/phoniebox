import React, { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import {
  Grid,
} from '@mui/material';

import Albums from './albums';
import SongList from './albums/song-list';
import Folders from './folders';
import LibraryHeader from "../library-header";
import SelectorHeader from "../selector-header";
import Upload from "../upload";

import request from '../../../utils/request';
import { buildActionData } from '../../Cards/utils';

const LibraryLists = () => {
  const navigate = useNavigate();
  const { search: urlSearch } = useLocation();
  const [searchParams] = useSearchParams();
  const [isSelecting] = useState(searchParams.get('isSelecting'));
  const [cardId] = useState(searchParams.get('cardId'));
  const [musicFilter, setMusicFilter] = useState('');
  // When picking music for a card, hide items already assigned to a card by
  // default; the SelectorHeader switch reveals everything.
  const [showAll, setShowAll] = useState(false);
  const [cardsList, setCardsList] = useState({});

  useEffect(() => {
    if (!isSelecting) return;
    request('cardsList').then(({ result }) => {
      if (result) setCardsList(result);
    });
  }, [isSelecting]);

  // Sets of media values already assigned to any card, keyed by play command.
  const assigned = useMemo(() => {
    const folders = new Set();
    const files = new Set();
    Object.values(cardsList || {}).forEach((card) => {
      const value = card?.action?.args?.[0];
      if (value === undefined || value === null) return;
      if (card.from_alias === 'play_folder') folders.add(String(value));
      if (card.from_alias === 'play_single') files.add(String(value));
    });
    return { folders, files };
  }, [cardsList]);

  const isAssigned = (item) => {
    if (item.type === 'directory') return assigned.folders.has(String(item.relpath));
    if (item.type === 'file') return assigned.files.has(String(item.relpath));
    return false;
  };

  const handleMusicFilter = (event) => {
    setMusicFilter(event.target.value);
  };

  const registerMusicToCard = (command, args) => {
    const actionData = buildActionData('play_music', command, args);
    const state = {
      registerCard: {
        actionData,
        cardId,
      },
    };

    navigate('/cards/register', { state });
  };

  return (
    <Grid container id="library">
      {isSelecting && <SelectorHeader showAll={showAll} setShowAll={setShowAll} />}
      {!isSelecting && <Upload />}
      <Grid container sx={{ padding: '10px' }}>
        <LibraryHeader
          handleMusicFilter={handleMusicFilter}
          musicFilter={musicFilter}
        />
        <Grid
          container
          spacing={1}
          sx={{
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Routes>
            <Route
              path="albums"
              element={<Albums musicFilter={musicFilter} />}
              exact
            />
            <Route
              path="albums/:artist/:album"
              element={
                <SongList
                  isSelecting={isSelecting}
                  registerMusicToCard={registerMusicToCard}
                />
              }
              exact
            />
            <Route
              path="folders"
              element={<Navigate to={`.%2F${urlSearch}`} replace />}
            />
            <Route
              path="folders/:dir"
              element={
                <Folders
                  musicFilter={musicFilter}
                  isSelecting={isSelecting}
                  registerMusicToCard={registerMusicToCard}
                  isAssigned={isAssigned}
                  showAll={showAll}
                />
              }
            />
          </Routes>
        </Grid>
      </Grid>
    </Grid>
  );
};

export default LibraryLists;
