export interface TeamMember {
  name: string;
  email: string;
}

export interface PluginSettings {
  members: TeamMember[];
  notifyOnComment: boolean;
  notifyOnMention: boolean;
}

export interface Reply {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  selectedText: string;
  lineNumber: number;
  resolved: boolean;
  replies: Reply[];
  mentions: string[];
  notifiedTo: string[];
}

export interface DocumentComments {
  filePath: string;
  comments: Comment[];
}

export interface MentionRecord {
  [filePath: string]: string[];
}
