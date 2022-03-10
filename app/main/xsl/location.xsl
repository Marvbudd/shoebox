<?xml version="1.0"?>
<xsl:stylesheet
   xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
   xmlns="http://www.w3.org/TR/REC-html40"
   version="2.0">
	<!-- Root template -->
	<xsl:template match="/">
		<xsl:apply-templates/>
	</xsl:template>
	<xsl:template match="accessions">
		<table class="maintable">
			<thead>
				<tr class="firstRow">
					<td>Location</td>
					<td class="date">Date</td>
				</tr>
			</thead>
			<tbody>
				<xsl:apply-templates>
					<xsl:sort select="location/state"/>
					<xsl:sort select="location/city"/>
					<xsl:sort select="location/detail"/>
					<xsl:sort select="date/year"/>
					<xsl:sort select="date/month"/>
					<xsl:sort select="date/day"/>
				</xsl:apply-templates>
			</tbody>
		</table>
	</xsl:template>
	<xsl:template match="item">
		<tr>
			<xsl:attribute name='class'>
				<xsl:value-of select="./type" />
			</xsl:attribute>
			<xsl:attribute name="accession">
				<xsl:value-of select="accession"/>
			</xsl:attribute>
      <xsl:attribute name="categories">
        <xsl:value-of select="./@categories" />
      </xsl:attribute>
			<td>
				<div>
					<xsl:if test="./location/detail">
						<xsl:value-of select="./location/detail"/>, <xsl:value-of select="./location/city"/>, <xsl:value-of select="./location/state"/>
					</xsl:if>
					<xsl:if test="not(./location/detail)">
						<xsl:if test="./location/city">
							<xsl:value-of select="./location/city"/>, <xsl:value-of select="./location/state"/>
						</xsl:if>
						<xsl:if test="not(./location/city)">
							<xsl:value-of select="./location/state"/>
						</xsl:if>
					</xsl:if>
				</div>
			</td>
			<td>
				<div class="dateData">
					<xsl:apply-templates select="./date"/>
				</div>
			</td>
		</tr>
	</xsl:template>
	<xsl:template match="date">
		<xsl:value-of select="day" />
		<xsl:text> </xsl:text>
		<xsl:value-of select="month" />
		<xsl:text> </xsl:text>
		<xsl:value-of select="year" />
	  </xsl:template>
	</xsl:stylesheet>