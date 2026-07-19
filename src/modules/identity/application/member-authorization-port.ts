export interface MemberAuthorizationPort {
  isActiveMember(userId: string): Promise<boolean>;
}
