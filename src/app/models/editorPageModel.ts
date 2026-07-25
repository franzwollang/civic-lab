import {
  defineClientPageModel,
  defineHydratedScope,
  definePageTransition
} from 'dullahan-web/client';
import { z } from 'zod';

import { saveRevisionRemote } from '@/api/actions';
import { saveRevisionInput } from '@/api/schemas';

const editorUiScope = defineHydratedScope({
  profile: 'page-ui',
  schema: z.object({
    lastSavedRevisionId: z.string().nullable().default(null)
  })
});

export const editorPageModel = defineClientPageModel({
  clientOnly: { scope: editorUiScope },
  transitions: {
    saveRevision: definePageTransition({
      name: 'editor.saveRevision',
      tier: 'committed',
      input: saveRevisionInput,
      apply: ({ setClient }, { revision }) =>
        setClient({ lastSavedRevisionId: revision.revision_id }),
      remote: saveRevisionRemote,
      onError: ({ setClient }) => setClient({ lastSavedRevisionId: null })
    })
  }
});
