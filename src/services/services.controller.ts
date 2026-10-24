import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { AuthGuard } from '@nestjs/passport';
import { JWT_AUTH } from '../common/swagger';
import { CreateServiceDto } from './dtos/service.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Services')
@Controller('api/v1/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async findAll() {
    return this.servicesService.findAll();
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    return this.servicesService.findBySlug(slug);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth(JWT_AUTH)
  @Post()
  @ApiOperation({ summary: 'Create a service catalog item' })
  async create(@Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(createServiceDto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth(JWT_AUTH)
  @Put(':id')
  @ApiOperation({ summary: 'Update a service catalog item' })
  async update(@Param('id') id: string, @Body() updateServiceDto: CreateServiceDto) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth(JWT_AUTH)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service catalog item' })
  async delete(@Param('id') id: string) {
    return this.servicesService.delete(id);
  }
}
