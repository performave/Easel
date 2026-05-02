import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  IconBold,
  IconItalic,
  IconList,
  IconListNumbers,
  IconH2,
  IconH3,
  IconArrowBackUp,
  IconArrowForwardUp,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  disabled,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-md border bg-transparent overflow-hidden focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          icon={IconH2}
          title="Heading 2"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          icon={IconH3}
          title="Heading 3"
        />
        <Divider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          icon={IconBold}
          title="Bold"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          icon={IconItalic}
          title="Italic"
        />
        <Divider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          icon={IconList}
          title="Bullet list"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          icon={IconListNumbers}
          title="Numbered list"
        />
        <Divider />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          icon={IconArrowBackUp}
          title="Undo"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          icon={IconArrowForwardUp}
          title="Redo"
        />
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  icon: Icon,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  icon: typeof IconBold;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-4 w-px bg-border" />;
}
