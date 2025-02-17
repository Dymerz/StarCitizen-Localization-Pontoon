import { Localized } from '@fluent/react';
import escapeHtml from 'escape-html';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import {
  BaseEditor,
  createEditor,
  Descendant,
  Editor,
  Node,
  Range,
  Text,
  Transforms,
} from 'slate';
import {
  Editable,
  ReactEditor,
  RenderElementProps,
  Slate,
  withReact,
} from 'slate-react';

import type { MentionUser } from '~/api/user';
import { MentionUsers } from '~/context/MentionUsers';
import type { UserState } from '~/modules/user';
import { UserAvatar } from '~/modules/user';
import { useUserBanner } from '~/hooks/useUserBanner';

import './AddComment.css';
import { MentionList } from './MentionList';

type Props = {
  contactPerson?: string;
  initFocus: boolean;
  onAddComment(comment: string): void;
  resetContactPerson?: () => void;
  user: UserState;
};

type Paragraph = {
  type: 'paragraph';
  children: Descendant[];
};

type Mention = {
  type: 'mention';
  character: string;
  url: string | undefined;
  children: Text[];
};

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: Paragraph | Mention;
  }
}

function isEditable(elem: Element | null): boolean {
  if (!elem) {
    return false;
  }
  if (
    elem.tagName === 'INPUT' ||
    elem.tagName === 'TEXTAREA' ||
    elem.getAttribute('contenteditable') === 'true'
  ) {
    return true;
  }
  return isEditable(elem.parentElement);
}

export function AddComment({
  contactPerson,
  initFocus,
  onAddComment,
  resetContactPerson,
  user: { gravatarURLSmall, username },
}: Props): React.ReactElement<'div'> {
  const [mentionTarget, setMentionTarget] = useState<Range | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionSearch, setMentionSearch] = useState('');
  const [requireUsers, setRequireUsers] = useState(false);
  const banner = useUserBanner();

  const { initMentions, mentionUsers } = useContext(MentionUsers);
  const [slateKey, resetValue] = useReducer((key) => key + 1, 0);
  const initialValue = useMemo<Paragraph[]>(
    () => [{ type: 'paragraph', children: [{ text: '' }] }],
    [slateKey],
  );

  const editor = useMemo(() => withMentions(withReact(createEditor())), []);
  const placeFocus = useCallback(() => {
    ReactEditor.focus(editor);
    Transforms.select(editor, Editor.end(editor, []));
  }, []);
  const insertMention = useCallback(
    ({ name, url }: { name: string; url?: string }) => {
      const mention: Mention = {
        type: 'mention',
        character: name,
        url,
        children: [{ text: name }],
      };
      Transforms.insertNodes(editor, mention);
      Transforms.select(editor, Editor.end(editor, []));
      Transforms.insertText(editor, ' ');
    },
    [editor],
  );

  useEffect(initMentions, []);

  // Insert project manager as mention when 'Request context / Report issue' button used
  // and then clear the value from state
  useEffect(() => {
    if (contactPerson) {
      insertMention({ name: contactPerson });
      setRequireUsers(true);
      resetContactPerson?.();
      placeFocus();
    }
  }, [contactPerson, resetContactPerson]);

  // Set focus on Editor
  useEffect(() => {
    if (initFocus && !isEditable(document.activeElement)) {
      placeFocus();
    }
  }, [initFocus]);

  const suggestedUsers = mentionUsers
    .filter(
      (user) =>
        user.username?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
        user.name.toLowerCase().includes(mentionSearch.toLowerCase()),
    )
    .slice(0, 5);

  const handleEditableKeyDown = (event: React.KeyboardEvent) => {
    if (mentionTarget) {
      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const prevIndex =
            mentionIndex >= suggestedUsers.length - 1 ? 0 : mentionIndex + 1;
          setMentionIndex(prevIndex);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const nextIndex =
            mentionIndex <= 0 ? suggestedUsers.length - 1 : mentionIndex - 1;
          setMentionIndex(nextIndex);
          break;
        }
        case 'Tab':
        case 'Enter':
          event.preventDefault();
          Transforms.select(editor, mentionTarget);
          insertMention(suggestedUsers[mentionIndex]);
          setMentionTarget(null);
          placeFocus();
          break;
        case 'Escape':
          event.preventDefault();
          setMentionTarget(null);
          break;
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        /*
         * This allows for the new lines to render while adding comments.
         * To avoid an issue with the cursor placement and an error when
         * navigating with arrows that occurs in Firefox '\n' can't be
         * the last character so the BOM was added
         */
        editor.insertText('\n\uFEFF');
      } else {
        submitComment();
      }
    }
  };

  const handleSelectMention = (user: MentionUser) => {
    if (mentionTarget) {
      Transforms.select(editor, mentionTarget);
      insertMention(user);
      setMentionTarget(null);
    }
  };

  const handleEditorChange = () => {
    const { selection } = editor;

    if (selection && Range.isCollapsed(selection)) {
      const [start] = Range.edges(selection);
      const wordBefore = Editor.before(editor, start, { unit: 'word' });
      const before = wordBefore && Editor.before(editor, wordBefore);
      const beforeRange = before && Editor.range(editor, before, start);
      const beforeText = beforeRange && Editor.string(editor, beforeRange);
      // Unicode property escapes allow for matching non-ASCII characters
      const beforeMatch =
        beforeText && beforeText.match(/^@((\p{L}|\p{N}|\p{P})+)$/u);
      const after = Editor.after(editor, start);
      const afterRange = Editor.range(editor, start, after);
      const afterText = Editor.string(editor, afterRange);
      const afterMatch = afterText.match(/^(\s|$)/);

      if (beforeMatch && afterMatch) {
        setMentionTarget(beforeRange);
        setMentionSearch(beforeMatch[1]);
        setMentionIndex(0);
        return;
      }
    }

    setMentionTarget(null);
  };

  const submitComment = () => {
    if (
      Node.string(editor).trim() !== '' &&
      (!requireUsers || mentionUsers.length > 0)
    ) {
      const comment = editor.children
        .map((node) => serialize(node, mentionUsers))
        .join('');
      onAddComment(comment);

      Transforms.select(editor, {
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 0], offset: 0 },
      });
      resetValue();
    }
  };

  return (
    <div className='comment add-comment'>
      <UserAvatar
        username={username}
        imageUrl={gravatarURLSmall}
        userBanner={banner}
      />
      <div className='container'>
        <Slate
          editor={editor}
          key={slateKey}
          onChange={handleEditorChange}
          value={initialValue}
        >
          <Localized
            id='comments-AddComment--input'
            attrs={{ placeholder: true }}
          >
            <Editable
              className='comment-editor'
              name='comment'
              dir='auto'
              placeholder={`Write a comment…`}
              renderElement={RenderElement}
              onKeyDown={handleEditableKeyDown}
            />
          </Localized>
          {mentionTarget && suggestedUsers.length > 0 && (
            <MentionList
              editor={editor}
              index={mentionIndex}
              onSelect={handleSelectMention}
              suggestedUsers={suggestedUsers}
              target={mentionTarget}
            />
          )}
        </Slate>
        <Localized
          id='comments-AddComment--submit-button'
          attrs={{ title: true }}
          elems={{ glyph: <i className='fas fa-paper-plane' /> }}
        >
          <button
            className='submit-button'
            disabled={requireUsers && mentionUsers.length === 0}
            title='Submit comment'
            onClick={submitComment}
          >
            {'<glyph></glyph>'}
          </button>
        </Localized>
      </div>
    </div>
  );
}

const withMentions = (editor: BaseEditor & ReactEditor) => {
  const { isInline, isVoid } = editor;

  editor.isInline = (element) =>
    element.type === 'mention' ? true : isInline(element);
  editor.isVoid = (element) =>
    element.type === 'mention' ? true : isVoid(element);

  return editor;
};

function serialize(node: Descendant, users: MentionUser[]): string {
  if (Text.isText(node)) {
    return escapeHtml(node.text);
  }

  if (!node.type || !node.children) {
    return '';
  }

  const children = node.children.map((n) => serialize(n, users)).join('');

  switch (node.type) {
    case 'paragraph':
      return `<p>${children.trim()}</p>`;
    case 'mention': {
      const url =
        node.url ?? users.find((user) => user.name === node.character)?.url;
      return url ? `<a href="${escapeHtml(url)}">${children}</a>` : children;
    }
    default:
      return children;
  }
}

const RenderElement = ({
  attributes,
  children,
  element,
}: RenderElementProps) =>
  element.type === 'mention' ? (
    <span {...attributes} contentEditable={false} className='mention-element'>
      @{element.character}
      {children}
    </span>
  ) : (
    <p {...attributes}>{children}</p>
  );
