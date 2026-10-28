import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApplyKycDto {
  @IsEnum(['cni', 'passport'])
  documentType: 'cni' | 'passport';

  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @IsString()
  @IsNotEmpty()
  fullLegalName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  @IsNotEmpty()
  taxpayerIdNumber: string;
}
