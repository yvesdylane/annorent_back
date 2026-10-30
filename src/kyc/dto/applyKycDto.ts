import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class ApplyKycDto {
  @IsEnum(['individual', 'business'])
  applicantType: 'individual' | 'business' = 'individual';

  @ValidateIf((o) => o.applicantType !== 'business')
  @IsEnum(['cni', 'passport'])
  documentType?: 'cni' | 'passport';

  @ValidateIf((o) => o.applicantType !== 'business')
  @IsString()
  @IsNotEmpty()
  documentNumber?: string;

  @ValidateIf((o) => o.applicantType !== 'business')
  @IsString()
  @IsNotEmpty()
  fullLegalName?: string;

  @ValidateIf((o) => o.applicantType !== 'business')
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ValidateIf((o) => o.applicantType !== 'business')
  @IsString()
  taxpayerIdNumber?: string;

  @ValidateIf((o) => o.applicantType === 'business')
  @IsString()
  @IsNotEmpty()
  businessName?: string;

  @ValidateIf((o) => o.applicantType === 'business')
  @IsString()
  @IsNotEmpty()
  rccmNumber?: string;

  @ValidateIf((o) => o.applicantType === 'business')
  @IsString()
  niuNumber?: string;

  @ValidateIf((o) => o.applicantType === 'business')
  @IsString()
  @IsNotEmpty()
  legalRepresentativeName?: string;

  @ValidateIf((o) => o.applicantType === 'business')
  @IsString()
  legalRepresentativePhone?: string;
}
