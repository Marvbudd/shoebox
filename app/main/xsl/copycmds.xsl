<?xml version="1.0"?>

<xsl:stylesheet
   xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
   xmlns="http://www.w3.org/TR/REC-html40"
   version="2.0">

  <xsl:param name="category">${category}</xsl:param>
  <xsl:param name="sourceDir">${sourceDir}</xsl:param>
  <xsl:param name="destDir">${destDir}</xsl:param>

  <xsl:template match="/">#! /bin/bash

cp <xsl:value-of select="$sourceDir"/>/accessions.xsd<xsl:text> </xsl:text><xsl:value-of select="$destDir"/>/
mkdir <xsl:value-of select="$destDir"/><xsl:text>/audio</xsl:text>
mkdir <xsl:value-of select="$destDir"/><xsl:text>/photo</xsl:text>
mkdir <xsl:value-of select="$destDir"/><xsl:text>/video</xsl:text>
    <xsl:apply-templates />
  </xsl:template>

  <xsl:template match="accessions">
    <xsl:apply-templates select="item[contains(@categories, $category)]">
      <xsl:sort select="type" />
      <xsl:sort select="link" />
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template match='item'>
    <xsl:choose>
      <xsl:when test="type='photo'">
ln <xsl:value-of select="$sourceDir"/><xsl:text>/photo/</xsl:text><xsl:value-of select="./link" /><xsl:text> </xsl:text><xsl:value-of select="$destDir"/><xsl:text>/photo/</xsl:text>
      </xsl:when>
      <xsl:when test="type='tape'">
ln <xsl:value-of select="$sourceDir"/><xsl:text>/audio/</xsl:text><xsl:value-of select="./link" /><xsl:text> </xsl:text><xsl:value-of select="$destDir"/><xsl:text>/audio/</xsl:text>
      </xsl:when>
      <xsl:when test="type='video'">
ln <xsl:value-of select="$sourceDir"/><xsl:text>/video/</xsl:text><xsl:value-of select="./link" /><xsl:text> </xsl:text><xsl:value-of select="$destDir"/><xsl:text>/video/</xsl:text>
      </xsl:when>
      <xsl:otherwise>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>