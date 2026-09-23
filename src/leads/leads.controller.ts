import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('api/v1/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  async createLead(
    @Request() req: any,
    @Body() createLeadDto: CreateLeadDto,
  ) {
    return this.leadsService.create(
      createLeadDto,
      req.user.userId,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async findAll() {
    return this.leadsService.findAll();
  }
}