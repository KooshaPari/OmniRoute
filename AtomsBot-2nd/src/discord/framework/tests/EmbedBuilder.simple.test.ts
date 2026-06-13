import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock discord.js with our fixed EmbedBuilder
vi.mock('discord.js', async () => {
  const discordMocks = await import('../../../../tests/mocks/discord');
  return discordMocks.default;
});

// Import after mocking
import { EmbedBuilder } from 'discord.js';

describe('EmbedBuilder Mock', () => {

  let embed: any;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Create a new EmbedBuilder instance
    embed = new EmbedBuilder();
  });

  it('should be a function/constructor', () => {
    expect(typeof EmbedBuilder).toBe('function');
  });

  it('should instantiate correctly', () => {
    expect(embed).toBeInstanceOf(EmbedBuilder);
  });

  it('should have setTitle method that returns this for chaining', () => {
    expect(typeof embed.setTitle).toBe('function');
    const result = embed.setTitle('Test Title');
    expect(result).toBe(embed);
    expect(embed.setTitle).toHaveBeenCalledWith('Test Title');
    expect(embed.title).toBe('Test Title');
  });

  it('should have setDescription method that returns this for chaining', () => {
    expect(typeof embed.setDescription).toBe('function');
    const result = embed.setDescription('Test Description');
    expect(result).toBe(embed);
    expect(embed.setDescription).toHaveBeenCalledWith('Test Description');
    expect(embed.description).toBe('Test Description');
  });

  it('should have setColor method that returns this for chaining', () => {
    expect(typeof embed.setColor).toBe('function');
    const result = embed.setColor(0xFF0000);
    expect(result).toBe(embed);
    expect(embed.setColor).toHaveBeenCalledWith(0xFF0000);
    expect(embed.color).toBe(0xFF0000);
  });

  it('should have addFields method that returns this for chaining', () => {
    expect(typeof embed.addFields).toBe('function');
    const fields = [{ name: 'Test Field', value: 'Test Value', inline: false }];
    const result = embed.addFields(...fields);
    expect(result).toBe(embed);
    expect(embed.addFields).toHaveBeenCalledWith(...fields);
    expect(embed.fields).toEqual(fields);
  });

  it('should have setTimestamp method that returns this for chaining', () => {
    expect(typeof embed.setTimestamp).toBe('function');
    const result = embed.setTimestamp();
    expect(result).toBe(embed);
    expect(embed.setTimestamp).toHaveBeenCalled();
    expect(typeof embed.timestamp).toBe('string');
  });

  it('should have setFooter method that returns this for chaining', () => {
    expect(typeof embed.setFooter).toBe('function');
    const footer = { text: 'Test Footer', iconURL: 'http://test.com/icon.png' };
    const result = embed.setFooter(footer);
    expect(result).toBe(embed);
    expect(embed.setFooter).toHaveBeenCalledWith(footer);
    expect(embed.footer).toEqual(footer);
  });

  it('should have setAuthor method that returns this for chaining', () => {
    expect(typeof embed.setAuthor).toBe('function');
    const author = { name: 'Test Author', iconURL: 'http://test.com/author.png' };
    const result = embed.setAuthor(author);
    expect(result).toBe(embed);
    expect(embed.setAuthor).toHaveBeenCalledWith(author);
    expect(embed.author).toEqual(author);
  });

  it('should support method chaining', () => {
    const result = embed
      .setTitle('Chained Title')
      .setDescription('Chained Description')
      .setColor(0x00FF00)
      .addFields({ name: 'Chain Field', value: 'Chain Value' })
      .setTimestamp()
      .setFooter({ text: 'Chained Footer' });

    expect(result).toBe(embed);
    expect(embed.title).toBe('Chained Title');
    expect(embed.description).toBe('Chained Description');
    expect(embed.color).toBe(0x00FF00);
    expect(embed.fields).toContainEqual({ name: 'Chain Field', value: 'Chain Value' });
    expect(embed.footer).toEqual({ text: 'Chained Footer' });
  });

  it('should have proper data getter', () => {
    embed.setTitle('Data Test');
    embed.setDescription('Data Description');
    embed.setColor(0xFF0000);
    embed.addFields({ name: 'Data Field', value: 'Data Value' });

    const data = embed.data;
    expect(data).toEqual({
      title: 'Data Test',
      description: 'Data Description',
      color: 0xFF0000,
      fields: [{ name: 'Data Field', value: 'Data Value' }],
      footer: undefined,
      author: undefined,
      url: undefined,
      timestamp: undefined,
      image: undefined,
      thumbnail: undefined,
    });
  });

  it('should have working toJSON method', () => {
    embed.setTitle('JSON Test');
    const json = embed.toJSON();
    expect(json).toEqual(embed.data);
  });

  it('should have working static from method', () => {
    const data = {
      title: 'From Test',
      description: 'From Description',
      color: 0x0000FF,
      fields: [{ name: 'From Field', value: 'From Value' }]
    };
    
    const fromEmbed = EmbedBuilder.from(data);
    expect(fromEmbed).toBeInstanceOf(EmbedBuilder);
    expect(fromEmbed.title).toBe('From Test');
    expect(fromEmbed.description).toBe('From Description');
    expect(fromEmbed.color).toBe(0x0000FF);
    expect(fromEmbed.fields).toEqual([{ name: 'From Field', value: 'From Value' }]);
  });

});